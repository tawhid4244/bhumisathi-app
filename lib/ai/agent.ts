import type Anthropic from "@anthropic-ai/sdk";
import { ZodError } from "zod";
import { bn } from "../engines/rules";
import { runTool, toolsFor, tools as defaultRegistry } from "../tools/registry";
import { SYSTEM, type ToolContext, type ToolDefinition } from "../tools/types";
import { wrapDocument } from "./documents";
import { createMasker, maskDeep } from "./pii";
import { REFUSAL_REPLY, SATHI_SYSTEM_PROMPT, TOO_MANY_STEPS_REPLY } from "./prompts";
import type { AgentMessage, ModelProvider } from "./provider";
import { toAgentTools } from "./tools";

// The Sathi agent loop: the model chooses tools, engines compute, the model explains.
//
// - Read tools run straight away and their results go back to the model.
// - Write tools (register_*) are NEVER run by the loop. The loop stops and returns a
//   pending action; the citizen confirms or declines it in the app, and only then is it
//   run (resolvePending). So the AI cannot change the ledger on its own.
// - The conversation history is append-only and is returned to the caller every time.

type ToolUse = Anthropic.Beta.BetaToolUseBlock;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

export interface ToolCallRecord {
  id: string;
  name: string;
  kind: "read" | "write";
  input: unknown;
  ok: boolean;
  output?: unknown;
  error?: string;
}

export interface PendingAction {
  tool_use_id: string;
  name: string;
  input: Record<string, unknown>;
  /** The numbers read back to the citizen before they confirm. */
  summary_bn: string;
}

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; call: ToolCallRecord }
  | { type: "pending"; action: PendingAction };

export interface SourceRef {
  law_id: string;
  law_bn: string;
  section: string;
  title_bn: string;
  source: string;
}

export interface AgentResult {
  messages: AgentMessage[];
  reply: string;
  toolCalls: ToolCallRecord[];
  /** Law sections returned by law_search in this turn: shown under the answer. */
  sources: SourceRef[];
  pending: PendingAction | null;
  stopReason: string;
}

export interface RunAgentOptions {
  messages: AgentMessage[];
  provider: ModelProvider;
  registry?: ToolDefinition[];
  /**
   * Who is chatting. The model is shown ONLY the tools this user's role allows, and every call
   * is checked again by runTool. API routes always pass the signed-in user; the default (SYSTEM)
   * is for tests and scripts.
   */
  context?: ToolContext;
  onEvent?: (e: AgentEvent) => void;
  maxSteps?: number;
  /** The citizen's answer to a pending write action from the previous turn. */
  resolvePending?: { tool_use_id: string; approved: boolean };
  /**
   * Names to hide from the model (owners in the records). NIDs and phone numbers are always
   * hidden. The model sees placeholders like [ব্যক্তি-১]; the citizen sees the real values.
   */
  knownNames?: (string | string[])[];
  /** Language chosen in the app; English adds one line to the system prompt. */
  replyLanguage?: "bn" | "en";
  /** Builds the read-back text for a write action (owner names etc.). */
  describe?: (name: string, input: Record<string, unknown>) => Promise<string>;
}

const ACTION_BN: Record<string, string> = {
  register_baina: "বায়না নিবন্ধন",
  register_sale: "বিক্রয় দলিল নিবন্ধন",
  register_lien: "বন্ধক নিবন্ধন",
};

/** Default read-back: every number the action will use, in Bangla digits. */
export async function describeAction(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const parts = [
    `${input.mouza ?? ""} দাগ ${bn(String(input.dag_no ?? ""))}`,
    input.seller_id != null ? `বিক্রেতা #${bn(String(input.seller_id))}` : "",
    input.owner_id != null ? `মালিক #${bn(String(input.owner_id))}` : "",
    input.buyer_id != null ? `ক্রেতা #${bn(String(input.buyer_id))}` : "",
    input.lender_id != null ? `ব্যাংক #${bn(String(input.lender_id))}` : "",
    input.area_dec != null ? `${bn(String(input.area_dec))} শতক` : "",
    input.days != null ? `${bn(String(input.days))} দিন` : "",
  ].filter(Boolean);
  return `${ACTION_BN[name] ?? name}: ${parts.join(", ")}। ঠিক আছে?`;
}

/** Unique law sections returned by successful law_search calls. */
export function sourcesOf(calls: ToolCallRecord[]): SourceRef[] {
  const seen = new Map<string, SourceRef>();
  for (const c of calls) {
    if (c.name !== "law_search" || !c.ok || !Array.isArray(c.output)) continue;
    for (const h of c.output as SourceRef[]) {
      if (!seen.has(h.law_id)) {
        seen.set(h.law_id, { law_id: h.law_id, law_bn: h.law_bn, section: h.section, title_bn: h.title_bn, source: h.source }); // prettier-ignore
      }
    }
  }
  return [...seen.values()];
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function execute(
  use: ToolUse,
  registry: ToolDefinition[],
  ctx: ToolContext,
): Promise<{ record: ToolCallRecord; result: ToolResult }> {
  const def = registry.find((t) => t.name === use.name);
  const kind = def?.kind ?? "read";
  try {
    const output = await runTool(use.name, use.input, ctx, registry);
    return {
      record: { id: use.id, name: use.name, kind, input: use.input, ok: true, output },
      result: {
        type: "tool_result",
        tool_use_id: use.id,
        content: def?.untrusted
          ? wrapDocument(JSON.stringify(output), use.name)
          : JSON.stringify(output),
      },
    };
  } catch (err) {
    const message =
      err instanceof ZodError
        ? `Invalid input: ${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
        : err instanceof Error
          ? err.message
          : "Tool failed";
    return {
      record: { id: use.id, name: use.name, kind, input: use.input, ok: false, error: message },
      result: { type: "tool_result", tool_use_id: use.id, content: message, is_error: true },
    };
  }
}

export async function runAgent(opts: RunAgentOptions): Promise<AgentResult> {
  const ctx = opts.context ?? SYSTEM;
  // A citizen's model never even sees officer-only tools (register_*), so it cannot ask for them;
  // a forged "pending" write in the history is also refused, because it is not in this registry.
  const registry = ctx.system
    ? (opts.registry ?? defaultRegistry)
    : toolsFor(ctx.user, opts.registry ?? defaultRegistry);
  const describe = opts.describe ?? describeAction;
  const tools = toAgentTools(registry);
  const messages = [...opts.messages];
  const toolCalls: ToolCallRecord[] = [];
  const emit = (e: AgentEvent) => opts.onEvent?.(e);
  const isWrite = (name: string) => registry.find((t) => t.name === name)?.kind === "write";

  // 1. The citizen answered a pending write action: run (or decline) every tool call of
  //    that assistant turn, then let the model continue.
  if (opts.resolvePending) {
    const last = messages.at(-1);
    const uses =
      last?.role === "assistant" && Array.isArray(last.content)
        ? (last.content.filter((b) => b.type === "tool_use") as ToolUse[])
        : [];
    if (!uses.some((u) => u.id === opts.resolvePending!.tool_use_id)) {
      throw new Error("No pending action with that id at the end of the conversation.");
    }
    const results: ToolResult[] = [];
    let writesSeen = 0;
    for (const use of uses) {
      const approvedWrite =
        use.id === opts.resolvePending.tool_use_id && opts.resolvePending.approved;
      if (isWrite(use.name) && (!approvedWrite || writesSeen++ > 0)) {
        const declined: ToolCallRecord = {
          id: use.id,
          name: use.name,
          kind: "write",
          input: use.input,
          ok: false,
          error: "declined",
        };
        toolCalls.push(declined);
        emit({ type: "tool", call: declined });
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content:
            "The citizen did NOT confirm this action, so it was not recorded. Do not retry unless they ask again.",
        });
        continue;
      }
      const { record, result } = await execute(use, registry, ctx);
      toolCalls.push(record);
      emit({ type: "tool", call: record });
      results.push(result);
    }
    messages.push({ role: "user", content: results });
  }

  // 2. The loop: ask the model, run read tools, repeat until it answers.
  const maxSteps = opts.maxSteps ?? 8;
  const system =
    opts.replyLanguage === "en"
      ? `${SATHI_SYSTEM_PROMPT}

The person chose English in the app: reply in English.`
      : SATHI_SYSTEM_PROMPT;
  for (let step = 0; step < maxSteps; step++) {
    // Privacy: the model only ever receives a masked COPY of the conversation.
    const masker = createMasker(opts.knownNames ?? []);
    const masked = maskDeep(messages, masker);
    const raw = await opts.provider.send({ system, tools, messages: masked }, (delta) =>
      emit({ type: "text", delta: masker.unmask(delta) }),
    );
    // Put real values back into the answer (and any tool input) before anything else sees it.
    const res = { ...raw, content: maskDeep(raw.content, masker, "unmask") };
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "refusal") {
      return {
        messages,
        reply: REFUSAL_REPLY,
        toolCalls,
        sources: [],
        pending: null,
        stopReason: "refusal",
      };
    }
    if (res.stop_reason === "pause_turn") continue;

    const uses = res.content.filter((b): b is ToolUse => b.type === "tool_use");
    // Never run tools from a response cut off by max_tokens: their input may be incomplete.
    if (res.stop_reason !== "tool_use" || uses.length === 0) {
      return {
        messages,
        reply: textOf(res.content),
        toolCalls,
        sources: sourcesOf(toolCalls),
        pending: null,
        stopReason: res.stop_reason ?? "end_turn",
      };
    }

    const write = uses.find((u) => isWrite(u.name));
    if (write) {
      const input = (write.input ?? {}) as Record<string, unknown>;
      const action: PendingAction = {
        tool_use_id: write.id,
        name: write.name,
        input,
        summary_bn: await describe(write.name, input).catch(() =>
          describeAction(write.name, input),
        ),
      };
      emit({ type: "pending", action });
      return {
        messages,
        reply: textOf(res.content),
        toolCalls,
        sources: sourcesOf(toolCalls),
        pending: action,
        stopReason: "awaiting_confirmation",
      };
    }

    // Read tools run in parallel; all results go back in ONE user message.
    const done = await Promise.all(uses.map((u) => execute(u, registry, ctx)));
    for (const d of done) {
      toolCalls.push(d.record);
      emit({ type: "tool", call: d.record });
    }
    messages.push({ role: "user", content: done.map((d) => d.result) });
  }

  return {
    messages,
    reply: TOO_MANY_STEPS_REPLY,
    toolCalls,
    sources: sourcesOf(toolCalls),
    pending: null,
    stopReason: "max_steps",
  };
}

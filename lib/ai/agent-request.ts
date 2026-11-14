import { z } from "zod";
import type { AgentResult, ToolCallRecord } from "./agent";
import type { AgentMessage } from "./provider";

// Shared request checking for /api/agent and /api/agent/stream.
// The browser keeps the conversation and sends it back each turn; the server stores nothing.

export const MAX_BODY_BYTES = 400_000;

export const agentBodySchema = z
  .object({
    messages: z.array(z.any()).max(80).default([]),
    message: z.string().trim().min(1).max(1000).optional(),
    confirm: z
      .object({ tool_use_id: z.string().min(1).max(100), approved: z.boolean() })
      .optional(),
    lang: z.enum(["bn", "en"]).default("bn"),
  })
  .refine((b) => (b.message ? 1 : 0) + (b.confirm ? 1 : 0) === 1, {
    message: "Send either a message or a confirmation.",
  });

export type AgentBody = z.infer<typeof agentBodySchema>;

export type ParseResult =
  | { ok: true; body: AgentBody; messages: AgentMessage[] }
  | { ok: false; status: number; error: { bn: string; en: string } };

export function parseAgentRequest(raw: string): ParseResult {
  if (raw.length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: { bn: "কথোপকথন খুব বড় হয়ে গেছে। নতুন করে শুরু করুন।", en: "Conversation too long." } }; // prettier-ignore
  }
  try {
    const body = agentBodySchema.parse(JSON.parse(raw));
    const history = body.messages as AgentMessage[];
    const messages: AgentMessage[] = body.message
      ? [...history, { role: "user", content: body.message }]
      : history;
    return { ok: true, body, messages };
  } catch {
    return { ok: false, status: 400, error: { bn: "অনুরোধটি সঠিক নয়।", en: "Invalid request." } };
  }
}

/** What the chat screen needs to know about a tool call (not its full output). */
export interface ToolBadge {
  id: string;
  name: string;
  kind: "read" | "write";
  ok: boolean;
  error?: string;
  verdict?: "red" | "amber" | "green";
  verdict_bn?: string;
  mouza_en?: string;
  dag_no?: number;
  ref?: string;
  blocked_bn?: string;
}

export function toBadge(c: ToolCallRecord): ToolBadge {
  const b: ToolBadge = { id: c.id, name: c.name, kind: c.kind, ok: c.ok, error: c.error };
  const o = c.output as Record<string, unknown> | undefined;
  if (c.ok && c.name === "jomi_check" && o) {
    const dag = o.dag as { mouza_en: string; dag_no: number };
    Object.assign(b, { verdict: o.verdict, verdict_bn: o.verdict_bn, mouza_en: dag.mouza_en, dag_no: dag.dag_no }); // prettier-ignore
  }
  if (c.ok && c.name.startsWith("register_") && o) {
    if (o.ok) b.ref = o.ref as string;
    else b.blocked_bn = o.reason_bn as string;
  }
  return b;
}

/** The final payload sent to the browser at the end of a turn. */
export function finalPayload(r: AgentResult) {
  return {
    messages: r.messages,
    reply: r.reply,
    sources: r.sources,
    pending: r.pending,
    stopReason: r.stopReason,
    badges: r.toolCalls.map(toBadge),
  };
}

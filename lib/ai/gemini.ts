import {
  ApiError,
  FinishReason,
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";
import type Anthropic from "@anthropic-ai/sdk";
import type {
  AgentMessage,
  AgentResponse,
  AgentTool,
  ChatRequest,
  ModelProvider,
} from "./provider";

// Gemini adapter. The agent loop keeps ONE message format (the one in provider.ts); this file
// translates it to Gemini's format on the way out and back again on the way in. So the loop,
// the confirmation gate and the tests are the same whichever model runs.
//
// Gemini returns a "thought signature" on some parts and expects it back unchanged next turn.
// We keep it on the translated block in a field named `_gemini_sig`.

type Block = Anthropic.Beta.BetaContentBlock;
type BlockWithSig = Block & { _gemini_sig?: string };

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

const REFUSAL_REASONS = new Set<string>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
]);

/** Registry tools → Gemini function declarations (same JSON Schema). */
export function toGeminiTools(tools: AgentTool[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.input_schema,
  }));
}

/** Our conversation → Gemini contents. */
export function toGeminiContents(messages: AgentMessage[]): Content[] {
  // Tool results only carry the call id; Gemini also wants the function name.
  const nameById = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.content)) {
      for (const b of m.content) if (b.type === "tool_use") nameById.set(b.id, b.name);
    }
  }

  const contents: Content[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") {
      contents.push({ role, parts: [{ text: m.content }] });
      continue;
    }
    const parts: Part[] = [];
    // Blocks in a message can be text, tool_use, tool_result or thinking; read them loosely.
    const blocks = (m.content ?? []) as unknown as ({ type: string } & { _gemini_sig?: string })[];
    for (const b of blocks) {
      const sig = b._gemini_sig ? { thoughtSignature: b._gemini_sig } : {};
      if (b.type === "text") {
        parts.push({ text: (b as unknown as { text: string }).text, ...sig });
      } else if (b.type === "tool_use") {
        const u = b as unknown as { id: string; name: string; input: unknown };
        parts.push({
          functionCall: {
            id: u.id,
            name: u.name,
            args: (u.input ?? {}) as Record<string, unknown>,
          },
          ...sig,
        });
      } else if (b.type === "tool_result") {
        const r = b as unknown as { tool_use_id: string; content?: unknown; is_error?: boolean };
        const rawContent =
          typeof r.content === "string" ? r.content : JSON.stringify(r.content ?? "");
        let value: unknown = rawContent;
        try {
          value = JSON.parse(rawContent);
        } catch {
          /* plain text result */
        }
        parts.push({
          functionResponse: {
            id: r.tool_use_id,
            name: nameById.get(r.tool_use_id) ?? "unknown",
            response: r.is_error ? { error: value } : { result: value },
          },
        });
      }
      // thinking / other block types are not sent to Gemini.
    }
    if (parts.length > 0) contents.push({ role, parts });
  }
  return contents;
}

/** Gemini response → our response shape (text and tool_use blocks, stop reason). */
export function fromGeminiResponse(res: GenerateContentResponse, model: string): AgentResponse {
  const candidate = res.candidates?.[0];
  const finish = candidate?.finishReason ?? "";
  const parts = candidate?.content?.parts ?? [];
  const content: BlockWithSig[] = [];
  let callNo = 0;

  for (const p of parts) {
    if (p.thought) continue; // internal reasoning summaries are not part of the answer
    const sig = p.thoughtSignature ? { _gemini_sig: p.thoughtSignature } : {};
    if (p.functionCall?.name) {
      content.push({
        type: "tool_use",
        id: p.functionCall.id || `gm_${Date.now().toString(36)}_${callNo++}`,
        name: p.functionCall.name,
        input: p.functionCall.args ?? {},
        ...sig,
      } as unknown as BlockWithSig);
    } else if (typeof p.text === "string" && p.text.length > 0) {
      content.push({ type: "text", text: p.text, citations: null, ...sig } as BlockWithSig);
    }
  }

  const blocked = Boolean(res.promptFeedback?.blockReason) || REFUSAL_REASONS.has(finish);
  const stop_reason = blocked
    ? "refusal"
    : content.some((b) => b.type === "tool_use")
      ? "tool_use"
      : finish === FinishReason.MAX_TOKENS
        ? "max_tokens"
        : "end_turn";

  return {
    id: res.responseId ?? `gm_${Date.now().toString(36)}`,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason,
    stop_sequence: null,
    usage: {
      input_tokens: res.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: res.usageMetadata?.candidatesTokenCount ?? 0,
    },
  } as unknown as AgentResponse;
}

/** Backup models tried in order when the main one is busy (503) or rate-limited (429). */
export const DEFAULT_GEMINI_FALLBACKS = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];

/** Longest we wait for one request before moving on to the next model. */
export const GEMINI_TIMEOUT_MS = 45_000;

/** "Busy, try again" errors: worth a retry. Anything else (bad key, bad request) is not. */
function statusOf(err: unknown): number | undefined {
  return err instanceof ApiError ? err.status : (err as { status?: number })?.status;
}

export function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  return status === 429 || status === 500 || status === 503 || status === 504;
}

type Generate = (args: {
  model: string;
  contents: Content[];
  config: Record<string, unknown>;
}) => Promise<GenerateContentResponse>;

export interface GeminiOptions {
  fallbacks?: string[];
  retriesPerModel?: number;
  /** Injected in tests so they do not call Google or wait. */
  generate?: Generate;
  sleep?: (ms: number) => Promise<void>;
}

export class GeminiProvider implements ModelProvider {
  readonly model: string;
  private generate: Generate;
  private chain: string[];
  private retries: number;
  private sleep: (ms: number) => Promise<void>;

  constructor(apiKey: string, model: string, opts: GeminiOptions = {}) {
    const ai = opts.generate ? null : new GoogleGenAI({ apiKey });
    this.generate = opts.generate ?? ((args) => ai!.models.generateContent(args));
    this.model = model;
    this.chain = [model, ...(opts.fallbacks ?? DEFAULT_GEMINI_FALLBACKS)].filter(
      (m, i, all) => m && all.indexOf(m) === i,
    );
    this.retries = opts.retriesPerModel ?? 1;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async send(req: ChatRequest, onText?: (delta: string) => void): Promise<AgentResponse> {
    const contents = toGeminiContents(req.messages);
    const config = {
      systemInstruction: req.system,
      tools: req.tools.length ? [{ functionDeclarations: toGeminiTools(req.tools) }] : undefined,
      maxOutputTokens: 8192,
      // Low thinking keeps chat replies quick; the engines do the hard work, not the model.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
    };
    let lastError: unknown;
    // Try the main model, then each backup; retry each once after a short wait.
    for (const model of this.chain) {
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          const res = await this.generate({ model, contents, config });
          const out = fromGeminiResponse(res, model);
          if (onText) {
            for (const b of out.content) if (b.type === "text") onText(b.text);
          }
          return out;
        } catch (err) {
          lastError = err;
          if (!isRetryable(err)) throw err;
          if (statusOf(err) === 504) break; // timed out: waiting again would only add delay
          if (attempt < this.retries) await this.sleep(1500 * (attempt + 1));
        }
      }
    }
    throw lastError;
  }
}

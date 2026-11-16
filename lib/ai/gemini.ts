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

/** Longest we wait for one whole request before moving on to the next model. */
export const GEMINI_TIMEOUT_MS = 30_000;

/**
 * Longest we wait for the FIRST streamed piece of an answer from the quick model. It starts
 * within 1–3 s when healthy; a busy one is skipped for the next model instead of keeping the
 * citizen waiting. The larger fallback models think first, so they get GEMINI_SLOW_FIRST_CHUNK_MS.
 */
export const GEMINI_FIRST_CHUNK_MS = 8_000;
export const GEMINI_SLOW_FIRST_CHUNK_MS = 25_000;

/**
 * Small, quick model tried first. Measured 2026-11-17 (scripts/ai-latency.ts): ~1–2 s per step
 * with minimal thinking, while gemini-3.5-flash / 3.8-flash took 14–25 s (more than 8 s before
 * the first word). The main model stays as the fallback when the quick one is busy.
 */
export const DEFAULT_ROUTER_MODEL = "gemini-3.1-flash-lite";

/** A tool-choosing step: the last message is the citizen's own question (not tool results). */
export function isRoutingStep(messages: AgentMessage[]): boolean {
  const last = messages.at(-1);
  if (!last || last.role !== "user") return false;
  if (typeof last.content === "string") return true;
  return (last.content as { type: string }[]).every((b) => b.type === "text");
}

const THINKING: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * Join streamed chunks into one response: parts in order, neighbouring text pieces merged
 * (keeping the last thought signature), finish reason and usage from the last chunk that has them.
 */
export function joinChunks(chunks: GenerateContentResponse[]): GenerateContentResponse {
  const parts: Part[] = [];
  let finishReason: FinishReason | undefined;
  let usage: GenerateContentResponse["usageMetadata"];
  let feedback: GenerateContentResponse["promptFeedback"];
  let id: string | undefined;
  for (const c of chunks) {
    id ??= c.responseId;
    if (c.usageMetadata) usage = c.usageMetadata;
    if (c.promptFeedback) feedback = c.promptFeedback;
    const cand = c.candidates?.[0];
    if (cand?.finishReason) finishReason = cand.finishReason;
    for (const p of cand?.content?.parts ?? []) {
      const prev = parts.at(-1);
      const isText = typeof p.text === "string" && !p.functionCall;
      if (
        isText &&
        prev &&
        typeof prev.text === "string" &&
        !prev.functionCall &&
        !!prev.thought === !!p.thought
      ) {
        // prettier-ignore
        prev.text += p.text!;
        if (p.thoughtSignature) prev.thoughtSignature = p.thoughtSignature;
      } else {
        parts.push({ ...p });
      }
    }
  }
  return {
    responseId: id,
    candidates: [{ content: { role: "model", parts }, finishReason }],
    usageMetadata: usage,
    promptFeedback: feedback,
  } as GenerateContentResponse;
}

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

type GenerateStream = (args: {
  model: string;
  contents: Content[];
  config: Record<string, unknown>;
}) => Promise<AsyncGenerator<GenerateContentResponse>>;

export interface GeminiOptions {
  fallbacks?: string[];
  /** Quick model tried first ("" turns it off: the main model does every step). */
  routerModel?: string;
  /** "all" (default): the quick model also writes the answers; "tools": only picks tools. */
  routerSteps?: "all" | "tools";
  /** minimal | low | medium | high (default minimal: the engines do the hard work). */
  thinking?: string;
  /** Streams answers as they are written (default on unless `generate` is injected). */
  generateStream?: GenerateStream;
  firstChunkMs?: number;
  /** First-chunk wait for the other (larger) models in the chain. */
  slowFirstChunkMs?: number;
  retriesPerModel?: number;
  /** Injected in tests so they do not call Google or wait. */
  generate?: Generate;
  sleep?: (ms: number) => Promise<void>;
}

export class GeminiProvider implements ModelProvider {
  readonly model: string;
  private generate: Generate;
  private generateStream: GenerateStream | null;
  private chain: string[];
  private router: string;
  private routerSteps: "all" | "tools";
  private thinking: ThinkingLevel;
  private retries: number;
  private firstChunkMs: number;
  private slowFirstChunkMs: number;
  private sleep: (ms: number) => Promise<void>;

  constructor(apiKey: string, model: string, opts: GeminiOptions = {}) {
    const ai = opts.generate && !opts.generateStream ? null : new GoogleGenAI({ apiKey });
    this.generate = opts.generate ?? ((args) => ai!.models.generateContent(args));
    this.generateStream =
      opts.generateStream ??
      (opts.generate ? null : (args) => ai!.models.generateContentStream(args));
    this.model = model;
    this.chain = [model, ...(opts.fallbacks ?? DEFAULT_GEMINI_FALLBACKS)].filter(
      (m, i, all) => m && all.indexOf(m) === i,
    );
    this.router = opts.routerModel ?? "";
    this.routerSteps = opts.routerSteps ?? "all";
    this.thinking = THINKING[(opts.thinking ?? "minimal").toLowerCase()] ?? ThinkingLevel.MINIMAL;
    this.retries = opts.retriesPerModel ?? 1;
    this.firstChunkMs = opts.firstChunkMs ?? GEMINI_FIRST_CHUNK_MS;
    this.slowFirstChunkMs = opts.slowFirstChunkMs ?? GEMINI_SLOW_FIRST_CHUNK_MS;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Models to try for this request, in order. */
  chainFor(req: ChatRequest): string[] {
    if (!this.router || req.careful) return this.chain;
    if (this.routerSteps === "tools" && !isRoutingStep(req.messages)) return this.chain;
    return [this.router, ...this.chain.filter((m) => m !== this.router)];
  }

  /** Models that refused the chosen thinking level; they get LOW instead (learned once). */
  private needsLow = new Set<string>();

  async send(req: ChatRequest, onText?: (delta: string) => void): Promise<AgentResponse> {
    const contents = toGeminiContents(req.messages);
    const base = {
      systemInstruction: req.system,
      tools: req.tools.length ? [{ functionDeclarations: toGeminiTools(req.tools) }] : undefined,
      maxOutputTokens: 8192,
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
    };
    // Minimal thinking keeps chat replies quick; the engines do the hard work, not the model.
    // Some models do not offer every level, so those fall back to LOW.
    const configFor = (model: string) => ({
      ...base,
      thinkingConfig: { thinkingLevel: this.needsLow.has(model) ? ThinkingLevel.LOW : this.thinking }, // prettier-ignore
    });
    let lastError: unknown;
    let streamed = false;
    // Try the router (for tool-choosing steps), the main model, then each backup; retry each
    // once after a short wait. Once text has reached the citizen we never switch models
    // (they would see two answers), so a failure after that is final.
    for (const model of this.chainFor(req)) {
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        const config = configFor(model);
        try {
          if (this.generateStream) {
            const res = await this.stream(model, contents, config, (t) => {
              streamed = true;
              onText?.(t);
            });
            return fromGeminiResponse(res, model);
          }
          const res = await this.generate({ model, contents, config });
          const out = fromGeminiResponse(res, model);
          if (onText) {
            for (const b of out.content) if (b.type === "text") onText(b.text);
          }
          return out;
        } catch (err) {
          lastError = err;
          if (process.env.AI_DEBUG) console.warn(`[gemini] ${model} try ${attempt + 1}: ${statusOf(err) ?? ""} ${String((err as Error).message).slice(0, 160)}`); // prettier-ignore
          if (streamed) throw err;
          if (
            statusOf(err) === 400 &&
            /thinking level/i.test(String((err as Error).message)) &&
            !this.needsLow.has(model)
          ) {
            // prettier-ignore
            this.needsLow.add(model);
            attempt--; // same model again, with LOW thinking; not counted as a retry
            continue;
          }
          if (!isRetryable(err)) throw err;
          if (statusOf(err) === 504) break; // timed out: waiting again would only add delay
          if (attempt < this.retries) await this.sleep(1500 * (attempt + 1));
        }
      }
    }
    throw lastError;
  }

  /** One streamed request. Gives up (as a 504) if the first piece takes too long. */
  private async stream(
    model: string,
    contents: Content[],
    config: Record<string, unknown>,
    onText: (t: string) => void,
  ): Promise<GenerateContentResponse> {
    const abort = new AbortController();
    // The quick model must start fast; with no quick model, or for the larger fallbacks,
    // allow the longer wait.
    const wait = this.router && model === this.router ? this.firstChunkMs : this.slowFirstChunkMs;
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => abort.abort(), wait);
    const chunks: GenerateContentResponse[] = [];
    try {
      const it = await this.generateStream!({
        model,
        contents,
        config: { ...config, abortSignal: abort.signal },
      });
      for await (const chunk of it) {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        chunks.push(chunk);
        for (const p of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (!p.thought && !p.functionCall && typeof p.text === "string" && p.text) onText(p.text);
        }
      }
    } catch (err) {
      if (abort.signal.aborted && chunks.length === 0) {
        throw Object.assign(new Error(`${model}: no answer within ${wait} ms`), {
          status: 504,
        });
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
    return joinChunks(chunks);
  }
}

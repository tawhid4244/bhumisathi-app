import {
  FinishReason,
  GoogleGenAI,
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

export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

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

export class GeminiProvider implements ModelProvider {
  readonly model: string;
  private ai: GoogleGenAI;

  constructor(apiKey: string, model: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async send(req: ChatRequest, onText?: (delta: string) => void): Promise<AgentResponse> {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: toGeminiContents(req.messages),
      config: {
        systemInstruction: req.system,
        tools: req.tools.length ? [{ functionDeclarations: toGeminiTools(req.tools) }] : undefined,
        maxOutputTokens: 8192,
      },
    });
    const out = fromGeminiResponse(res, this.model);
    if (onText) {
      for (const b of out.content) if (b.type === "text") onText(b.text);
    }
    return out;
  }
}

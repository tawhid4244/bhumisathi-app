import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_GEMINI_MODEL, DEFAULT_ROUTER_MODEL, GeminiProvider } from "./gemini";
import { MockProvider } from "./mock-provider";

// One adapter between BhumiSathi and the AI model. Model name and key come only from the
// environment (.env.local / Vercel). Tests swap in a scripted provider with the same interface.

export type AgentMessage = Anthropic.Beta.BetaMessageParam;
export type AgentResponse = Anthropic.Beta.BetaMessage;
export type AgentTool = Anthropic.Beta.BetaTool;

export interface ChatRequest {
  system: string;
  tools: AgentTool[];
  messages: AgentMessage[];
  /**
   * The request needs care more than speed (recording a sale, baina or mortgage): providers
   * with a quick model skip it and use the main model.
   */
  careful?: boolean;
}

export interface ModelProvider {
  readonly model: string;
  /** Send one request; `onText` receives streamed text as it arrives. */
  send(req: ChatRequest, onText?: (delta: string) => void): Promise<AgentResponse>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "AI is not configured: set AI_PROVIDER (gemini or anthropic) and AI_API_KEY in .env.local (npm run set-key).",
    );
    this.name = "AiNotConfiguredError";
  }
}

export const DEFAULT_CHAT_MODEL = "claude-opus-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

class AnthropicProvider implements ModelProvider {
  readonly model: string;
  private client: Anthropic;
  private effort: Effort;

  constructor(apiKey: string, model: string, effort: Effort) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.effort = effort;
  }

  async send(req: ChatRequest, onText?: (delta: string) => void): Promise<AgentResponse> {
    const stream = this.client.beta.messages.stream({
      model: this.model,
      max_tokens: 16000,
      // The system prompt never changes between requests, so it is cached.
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      tools: req.tools,
      messages: req.messages,
      // Opus 5.5 always thinks; effort sets how much. Medium is its default; set explicitly.
      thinking: { type: "adaptive" },
      output_config: { effort: this.effort },
      // If the model declines on safety grounds, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (onText) stream.on("text", onText);
    return stream.finalMessage();
  }
}

let cached: ModelProvider | undefined;

/**
 * The configured provider, chosen by AI_PROVIDER:
 *   gemini    → Google Gemini (default model gemini-flash-latest)
 *   anthropic → Claude (default model claude-opus-5-5)
 * Throws AiNotConfiguredError when the provider or key is missing.
 */
export function getProvider(): ModelProvider {
  if (cached) return cached;
  const provider = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  const model = process.env.AI_CHAT_MODEL?.trim();
  if (provider === "mock") {
    // Scripted stand-in for browser tests and offline demos (no key, no cost).
    cached = new MockProvider();
    return cached;
  }
  if (provider === "gemini") {
    const key = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) throw new AiNotConfiguredError();
    const fallbacks = process.env.AI_FALLBACK_MODELS?.split(",").map((m) => m.trim()).filter(Boolean); // prettier-ignore
    cached = new GeminiProvider(key, model || DEFAULT_GEMINI_MODEL, {
      fallbacks,
      // AI_ROUTER_MODEL="" turns the quick tool-choosing model off.
      routerModel: process.env.AI_ROUTER_MODEL ?? DEFAULT_ROUTER_MODEL,
      routerSteps: process.env.AI_ROUTER_STEPS === "tools" ? "tools" : "all",
      thinking: process.env.AI_THINKING,
    });
    return cached;
  }
  if (provider === "anthropic") {
    const key = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new AiNotConfiguredError();
    const effort = (process.env.AI_EFFORT as Effort) || "medium";
    cached = new AnthropicProvider(key, model || DEFAULT_CHAT_MODEL, effort);
    return cached;
  }
  throw new AiNotConfiguredError();
}

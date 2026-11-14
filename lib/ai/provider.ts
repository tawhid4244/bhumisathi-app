import Anthropic from "@anthropic-ai/sdk";

// One adapter between BhumiSathi and the AI model. Model name and key come only from the
// environment (.env.local / Vercel). Tests swap in a scripted provider with the same interface.

export type AgentMessage = Anthropic.Beta.BetaMessageParam;
export type AgentResponse = Anthropic.Beta.BetaMessage;
export type AgentTool = Anthropic.Beta.BetaTool;

export interface ChatRequest {
  system: string;
  tools: AgentTool[];
  messages: AgentMessage[];
}

export interface ModelProvider {
  readonly model: string;
  /** Send one request; `onText` receives streamed text as it arrives. */
  send(req: ChatRequest, onText?: (delta: string) => void): Promise<AgentResponse>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured: set AI_PROVIDER=anthropic and AI_API_KEY in .env.local.");
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

/** The configured provider. Throws AiNotConfiguredError when no key is set. */
export function getProvider(): ModelProvider {
  if (cached) return cached;
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  const key = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (provider !== "anthropic" || !key) throw new AiNotConfiguredError();
  const effort = (process.env.AI_EFFORT as Effort) || "medium";
  cached = new AnthropicProvider(key, process.env.AI_CHAT_MODEL || DEFAULT_CHAT_MODEL, effort);
  return cached;
}

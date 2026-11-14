import type Anthropic from "@anthropic-ai/sdk";
import type { AgentResponse, ChatRequest, ModelProvider } from "@/lib/ai/provider";

// A scripted stand-in for the model: each step looks at the request and returns blocks.
// Lets the agent loop be tested without a network call or an API key.

type Block = Anthropic.Beta.BetaContentBlock;
export type Step = (req: ChatRequest) => { content: Block[]; stop_reason: string };

export const text = (t: string): Block => ({ type: "text", text: t, citations: null }) as Block;
export const toolUse = (id: string, name: string, input: unknown): Block =>
  ({ type: "tool_use", id, name, input, caller: { type: "direct" } }) as unknown as Block;

/** The tool results the agent sent in the last user message, parsed from JSON. */
export function lastToolResults(
  req: ChatRequest,
): { id: string; data: unknown; isError: boolean }[] {
  const last = req.messages.at(-1);
  if (!last || last.role !== "user" || !Array.isArray(last.content)) return [];
  return last.content
    .filter((b) => b.type === "tool_result")
    .map((b) => {
      const r = b as Anthropic.Beta.BetaToolResultBlockParam;
      const raw = typeof r.content === "string" ? r.content : "";
      let data: unknown = raw;
      try {
        data = JSON.parse(raw);
      } catch {
        /* plain text result */
      }
      return { id: r.tool_use_id, data, isError: Boolean(r.is_error) };
    });
}

export class ScriptedProvider implements ModelProvider {
  readonly model = "mock-model";
  readonly requests: ChatRequest[] = [];
  private i = 0;
  constructor(private steps: Step[]) {}

  async send(req: ChatRequest, onText?: (d: string) => void): Promise<AgentResponse> {
    this.requests.push(structuredClone(req));
    const step = this.steps[this.i++];
    if (!step) throw new Error("ScriptedProvider ran out of steps");
    const { content, stop_reason } = step(req);
    for (const b of content) if (b.type === "text" && onText) onText(b.text);
    return {
      id: `msg_${this.i}`,
      type: "message",
      role: "assistant",
      model: this.model,
      content,
      stop_reason,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    } as unknown as AgentResponse;
  }
}

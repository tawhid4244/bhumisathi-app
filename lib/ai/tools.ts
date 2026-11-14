import { z } from "zod";
import type { ToolDefinition } from "../tools/types";
import type { AgentTool } from "./provider";

// Turns every registry tool into a tool definition the model understands.
// The same zod schema validates the model's input again before the tool runs (runTool).

export function toAgentTool(tool: ToolDefinition): AgentTool {
  const schema = z.toJSONSchema(tool.input, { io: "input" }) as Record<string, unknown>;
  delete schema.$schema;
  const writeNote =
    tool.kind === "write"
      ? "\nWRITE ACTION: the app shows the citizen a confirmation card with these numbers and runs it only after they press Yes."
      : "";
  return {
    name: tool.name,
    description: `${tool.description.en}\n${tool.description.bn}${writeNote}`,
    input_schema: schema as AgentTool["input_schema"],
    // Streamed tool input arrives as it is generated; runTool validates it before use.
    eager_input_streaming: true,
  };
}

export function toAgentTools(registry: ToolDefinition[]): AgentTool[] {
  return registry.map(toAgentTool);
}

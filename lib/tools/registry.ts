import {
  findDagTool,
  findPersonTool,
  ledgerStatusTool,
  registerBainaTool,
  registerLienTool,
  registerSaleTool,
} from "./ledger-tools";
import { jomiCheckTool } from "./check-tools";
import { deedReadTool } from "./deed-tools";
import { lawSearchTool } from "./law-tools";
import { warishComputeTool } from "./warish-tools";
import type { ToolDefinition } from "./types";

// The single list of everything BhumiSathi can do.
// Pages, API routes and the Sathi AI agent all call tools from here, so every feature
// runs the same engine code whichever way the citizen comes in.

export { defineTool, type ToolDefinition, type ToolKind } from "./types";

export const tools: ToolDefinition[] = [
  findDagTool,
  findPersonTool,
  ledgerStatusTool,
  registerBainaTool,
  registerSaleTool,
  registerLienTool,
  jomiCheckTool,
  lawSearchTool,
  warishComputeTool,
  deedReadTool,
] as ToolDefinition[];

export function getTool(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}

export class UnknownToolError extends Error {
  constructor(name: string) {
    super(`Unknown tool: ${name}`);
    this.name = "UnknownToolError";
  }
}

/**
 * Validate input with the tool's zod schema, run it, and validate the output.
 * Both checks matter: input may come from an AI model, and output is shown to citizens.
 */
export async function runTool(
  name: string,
  rawInput: unknown,
  registry: ToolDefinition[] = tools,
): Promise<unknown> {
  const tool = registry.find((t) => t.name === name);
  if (!tool) throw new UnknownToolError(name);
  const input = tool.input.parse(rawInput);
  const output = await tool.handler(input);
  return tool.output.parse(output);
}

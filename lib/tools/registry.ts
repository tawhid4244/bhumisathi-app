import { z } from "zod";

// The single list of everything BhumiSathi can do.
// Pages, API routes and the Sathi AI agent all call tools from here, so every feature
// runs the same engine code whichever way the citizen comes in.

export type ToolKind =
  /** Reads data only. The agent may call it without asking. */
  | "read"
  /** Changes the ledger or records. The agent must read the numbers back and get a "yes" first. */
  | "write";

export interface ToolDefinition<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  name: string;
  kind: ToolKind;
  description: { bn: string; en: string };
  input: I;
  output: O;
  handler: (input: z.infer<I>) => Promise<z.infer<O>>;
}

/** Helper that keeps each tool's input and output types linked to its zod schemas. */
export function defineTool<I extends z.ZodType, O extends z.ZodType>(
  tool: ToolDefinition<I, O>,
): ToolDefinition<I, O> {
  return tool;
}

// Tools are added here task by task (ledger_status in task 3, jomi_check in task 4, ...).
export const tools: ToolDefinition[] = [];

export function getTool(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
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
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const input = tool.input.parse(rawInput);
  const output = await tool.handler(input);
  return tool.output.parse(output);
}

import type { z } from "zod";

// Shape of one tool. Kept apart from registry.ts so tool files can import it without a cycle.

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

import type { z } from "zod";
import type { Access, SessionUser } from "../auth/roles";

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
  /** Lowest role that may run it (default "public"). Checked by runTool on every call. */
  access?: Access;
  /** Output contains outside document text (retrieved or uploaded): wrapped as data for the model. */
  untrusted?: boolean;
  input: I;
  output: O;
  handler: (input: z.infer<I>, ctx: ToolContext) => Promise<z.infer<O>>;
}

/** Who is calling. `system` is for trusted server code (seed, scripts, tests), never a request. */
export type ToolContext =
  { user: SessionUser | null; system?: false } | { user: null; system: true };

export const SYSTEM: ToolContext = { user: null, system: true };

/** Helper that keeps each tool's input and output types linked to its zod schemas. */
export function defineTool<I extends z.ZodType, O extends z.ZodType>(
  tool: ToolDefinition<I, O>,
): ToolDefinition<I, O> {
  return tool;
}

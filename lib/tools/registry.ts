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
import { mapAreaTool } from "./map-tools";
import { feeGuideTool, unitConvertTool } from "./units-tools";
import { warishComputeTool } from "./warish-tools";
import { allowed, type SessionUser } from "../auth/roles";
import type { ToolContext, ToolDefinition } from "./types";

// The single list of everything BhumiSathi can do.
// Pages, API routes and the Sathi AI agent all call tools from here, so every feature
// runs the same engine code whichever way the citizen comes in.

export { defineTool, SYSTEM, type ToolContext, type ToolDefinition, type ToolKind } from "./types";

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
  mapAreaTool,
  unitConvertTool,
  feeGuideTool,
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

/** The caller is not allowed to run this tool: 401 when signed out, 403 when the role is too low. */
export class AccessDeniedError extends Error {
  constructor(
    readonly tool: string,
    readonly signedIn: boolean,
  ) {
    super(`Access denied: ${tool}`);
    this.name = "AccessDeniedError";
  }
}

/** True when this user may run the tool. */
export function canUse(tool: ToolDefinition, user: SessionUser | null): boolean {
  return allowed(user, tool.access ?? "public");
}

/** The tools this user may use (the agent is only ever shown these). */
export function toolsFor(user: SessionUser | null, registry: ToolDefinition[] = tools) {
  return registry.filter((t) => canUse(t, user));
}

/**
 * Check the caller's role, validate input with the tool's zod schema, run it, and validate
 * the output. Every check matters: the caller may be anyone on the internet, input may come
 * from an AI model, and output is shown to citizens. `ctx` is required so no route can forget it.
 */
export async function runTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
  registry: ToolDefinition[] = tools,
): Promise<unknown> {
  const tool = registry.find((t) => t.name === name);
  if (!tool) throw new UnknownToolError(name);
  if (!ctx.system && !canUse(tool, ctx.user)) throw new AccessDeniedError(name, ctx.user !== null);
  const input = tool.input.parse(rawInput);
  const output = await tool.handler(input, ctx);
  return tool.output.parse(output);
}

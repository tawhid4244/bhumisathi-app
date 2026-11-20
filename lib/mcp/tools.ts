import { canUse, tools, type ToolDefinition } from "../tools/registry";

/** Tools an anonymous MCP client may see: read-only, public, and meant for an agent. */
export function mcpTools(registry: ToolDefinition[] = tools): ToolDefinition[] {
  return registry.filter((t) => t.kind === "read" && !t.hiddenFromAgent && canUse(t, null));
}

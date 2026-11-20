import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { toAgentTool } from "../ai/tools";
import { canUse, runTool, tools, type ToolDefinition } from "../tools/registry";

// BhumiSathi as an MCP server: other AI agents (a bank's assistant, Claude Desktop, a
// sub-registry system) can call the same verified land tools that Sathi AI and the pages use.
// Only public READ tools are offered, and every call goes through runTool as an anonymous
// caller, so input/output validation, role checks and the audit log apply exactly as on the web.
// Write tools (register_sale, …) are never exposed: they need the citizen's Yes and an officer.

/** Tools an anonymous MCP client may see: read-only, public, and meant for an agent. */
export function mcpTools(registry: ToolDefinition[] = tools): ToolDefinition[] {
  return registry.filter((t) => t.kind === "read" && !t.hiddenFromAgent && canUse(t, null));
}

export function createMcpServer(registry: ToolDefinition[] = tools): Server {
  const offered = mcpTools(registry);
  const server = new Server(
    { name: "bhumisathi", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "BhumiSathi land tools for Bangladesh (synthetic prototype data). Facts come from the share ledger and cited law sections; a Jomi Check verdict is a risk check on records, not a legal ruling.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: offered.map((t) => {
      const a = toAgentTool(t);
      return {
        name: a.name,
        description: a.description,
        inputSchema: a.input_schema as { type: "object"; [k: string]: unknown },
        annotations: { readOnlyHint: true, openWorldHint: false },
      };
    }),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    if (!offered.some((t) => t.name === name)) {
      return {
        isError: true,
        content: [{ type: "text", text: `Tool not available over MCP: ${name}` }],
      };
    }
    try {
      const out = await runTool(name, args ?? {}, { user: null }, registry);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    } catch (err) {
      // Short message only: no stack traces or SQL leave the server.
      const msg =
        err instanceof ZodError
          ? `Invalid input: ${err.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`
          : err instanceof Error && /not found/i.test(err.message)
            ? err.message
            : "Tool failed.";
      return { isError: true, content: [{ type: "text", text: msg }] };
    }
  });

  return server;
}

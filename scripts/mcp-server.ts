// npm run mcp → BhumiSathi's public read-only land tools as an MCP server over stdio.
// Claude Desktop / any MCP client: command "npm", args ["run", "--silent", "mcp"], cwd = this repo.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../lib/mcp/server";

// stdout carries the protocol; anything our libraries log must go to stderr instead.
console.log = (...a: unknown[]) => console.error(...a);

createMcpServer()
  .connect(new StdioServerTransport())
  .then(() => console.error("bhumisathi MCP server ready (stdio)"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

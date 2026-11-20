# BhumiSathi MCP server

BhumiSathi's verified land tools, offered to any AI agent through the Model Context Protocol.
A bank's assistant, a sub-registry system or Claude Desktop can check a plot with the same
code that Sathi AI and the web pages use: one tool registry, three ways in.

- **Code:** `lib/mcp/server.ts` (server) · `scripts/mcp-server.ts` (stdio entry) · test: `tests/integration/mcp.test.ts`
- **Transport:** stdio · **SDK:** `@modelcontextprotocol/sdk`
- **Run:** `npm run mcp` (reads `.env.local` for the database, like the other scripts)

## Tools offered (10, all read-only and public)

`jomi_check` (red/amber/green land check) · `law_search` (cited law sections, RAG) · `find_dag` ·
`map_area` · `fee_guide` · `unit_convert` · `warish_compute` (inheritance shares) ·
`land_tax_due` · `seal_verify` (is a sealed report genuine and current) · `application_track`

## Safety

- Only tools that are `kind: "read"`, public, and meant for an agent are listed. Ledger writes
  (`register_sale`, `register_baina`, `register_lien`), anything that needs a login, and deed
  uploads are never offered, and a call to them is refused.
- Every call runs through `runTool` as an anonymous caller: zod input and output validation,
  role checks and the hash-chained audit log apply exactly as on the web.
- Errors return a short message only: no stack traces or SQL.
- Tools are marked `readOnlyHint: true` so MCP clients know nothing changes.

## Use it from Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config), with your own path:

```json
{
  "mcpServers": {
    "bhumisathi": {
      "command": "npm",
      "args": ["run", "--silent", "mcp"],
      "cwd": "C:\\path\\to\\bhumisathi-app"
    }
  }
}
```

Then ask: "Use bhumisathi to check dag 142 in Nayapara" → red: the plot has a court case.

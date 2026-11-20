import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMcpServer } from "@/lib/mcp/server";
import { closeSql, getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";

// A real MCP client talks to the BhumiSathi MCP server (in-memory transport instead of stdio).

const sql = getSql();
const client = new Client({ name: "test-client", version: "1.0.0" });
const text = (r: Awaited<ReturnType<Client["callTool"]>>) =>
  (r.content as { type: string; text: string }[])[0]!.text;

beforeAll(async () => {
  await seed(sql);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([createMcpServer().connect(a), client.connect(b)]);
});
afterAll(async () => {
  await client.close();
  await closeSql();
});

describe("BhumiSathi MCP server", () => {
  it("offers only public read tools, never ledger writes", async () => {
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(["jomi_check", "law_search", "fee_guide", "unit_convert"]),
    );
    for (const w of [
      "register_sale",
      "register_baina",
      "register_lien",
      "ledger_status",
      "deed_read",
    ])
      expect(names).not.toContain(w);
  });

  it("jomi_check over MCP gives the same verdict as the app (dag 141 is green)", async () => {
    const r = await client.callTool({
      name: "jomi_check",
      arguments: { mouza: "Nayapara", dag_no: 141 },
    });
    expect(r.isError).toBeFalsy();
    expect(JSON.parse(text(r)).verdict).toBe("green");
  });

  it("law_search returns cited sections", async () => {
    const r = await client.callTool({ name: "law_search", arguments: { query: "নামজারি ফি" } });
    const hits = JSON.parse(text(r)) as { law_id: string; section: string }[];
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.section).toBeTruthy();
  });

  it("refuses write tools and bad input with a short error", async () => {
    const w = await client.callTool({ name: "register_sale", arguments: {} });
    expect(w.isError).toBe(true);
    expect(text(w)).toContain("not available");
    const bad = await client.callTool({ name: "law_search", arguments: { query: "x" } });
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain("Invalid input");
  });
});

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveUpload } from "@/lib/adapters/storage";
import { runAgent } from "@/lib/ai/agent";
import { MockProvider } from "@/lib/ai/mock-provider";
import { createMasker, knownNames } from "@/lib/ai/pii";
import type { AgentMessage } from "@/lib/ai/provider";
import { registerEvent } from "@/lib/engines/ledger";
import { closeSql, getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";
import { OWNER } from "@/scripts/seed-data";

// Task 15: ONE conversation runs the G1 check, reads the G3 deed and measures G8 on the map.
// Real tools, real records, the scripted mock model (AI_PROVIDER=mock behaviour).

const sql = getSql();
beforeAll(async () => {
  await seed(sql);
  process.env.AI_PROVIDER = "mock"; // deed_read uses the mock vision reader
});
afterAll(() => closeSql());

describe("one conversation, all tools", () => {
  it("G1 check → G3 deed → G8 map, history carried across turns", async () => {
    // G1 state: baina B-0021 then a blocked oversell on dag 145.
    await registerEvent({ type: "baina", mouza: "Nayapara", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.SALMA, area: 10 }); // prettier-ignore
    await registerEvent({ type: "sale", mouza: "Nayapara", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.JAMAL, area: 15 }); // prettier-ignore

    const provider = new MockProvider();
    const names = await knownNames();
    let history: AgentMessage[] = [];
    const turn = async (text: string) => {
      const r = await runAgent({ messages: [...history, { role: "user", content: text }], provider, knownNames: names }); // prettier-ignore
      history = r.messages;
      return r;
    };

    const g1 = await turn("১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও");
    expect(g1.toolCalls.map((c) => c.name)).toEqual(["find_dag", "jomi_check"]);
    expect((g1.toolCalls[1]!.output as { verdict: string }).verdict).toBe("red");
    expect(g1.reply).toContain("লাল");

    const { id } = await saveUpload(readFileSync("content/deeds/deed-4512.png"));
    const g3 = await turn(`দলিলের ছবি দিলাম — পড়ে রেকর্ডের সাথে মিলিয়ে দেখুন। (upload_id: ${id})`);
    expect(g3.toolCalls.map((c) => c.name)).toEqual(["deed_read"]);
    expect((g3.toolCalls[0]!.output as { verdict: string }).verdict).toBe("amber");
    expect(g3.reply).toContain("আমিন দিয়ে সীমানা যাচাই করুন");

    const g8 = await turn("১৪৫ নম্বর দাগের মাপ কত?");
    expect(g8.toolCalls.map((c) => c.name)).toEqual(["find_dag", "map_area"]);
    expect(g8.reply).toContain("প্রায় ২০.০৪ শতক");

    // All three turns live in one history.
    expect(history.filter((m) => m.role === "user" && typeof m.content === "string")).toHaveLength(
      3,
    );
  });

  it("an upload id with a long run of digits is never masked as an NID", () => {
    const m = createMasker();
    const msg = "(upload_id: ab1234567890123cdef45678)";
    expect(m.mask(msg)).toBe(msg);
  });
});

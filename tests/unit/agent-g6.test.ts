import { describe, expect, it } from "vitest";
import { runAgent } from "@/lib/ai/agent";
import type { LawHit } from "@/lib/ai/rag";
import { lawSearchTool } from "@/lib/tools/law-tools";
import type { ToolDefinition } from "@/lib/tools/types";
import { lastToolResults, ScriptedProvider, text, toolUse } from "../helpers/mock-provider";

// G6 through the agent loop: a scripted model, the REAL law_search tool (keyword mode, because
// no embedding key is set in tests). The answer must carry its sources.

process.env.AI_PROVIDER = ""; // keep embeddings off in unit tests
const registry = [lawSearchTool] as ToolDefinition[];
const REFUSAL = "আমি নিশ্চিত নই, অনুগ্রহ করে এসি ল্যান্ড অফিসে জিজ্ঞাসা করুন";

describe("G6: cited legal answer", () => {
  it("the mutation question is answered from the fee schedule with SAT Act s.143 as source", async () => {
    const model = new ScriptedProvider([
      () => ({ content: [toolUse("t1", "law_search", { query: "নামজারি করতে কী কী লাগবে আর খরচ কত?" })], stop_reason: "tool_use" }), // prettier-ignore
      (req) => {
        const hits = lastToolResults(req)[0]!.data as LawHit[];
        const fee = hits.find((h) => h.law_id === "mutation-fee")!;
        // The scripted model answers only from the returned text, like the real one must.
        expect(fee.excerpt).toContain("১,১৭০");
        return {
          content: [text(`মোট ১,১৭০ টাকা (২০ + ৫০ + ১,০০০ + ১০০)। সূত্র: ${hits.map((h) => `${h.law_bn}, ধারা ${h.section}`).join("; ")}`)], // prettier-ignore
          stop_reason: "end_turn",
        };
      },
    ]);
    const res = await runAgent({
      messages: [{ role: "user", content: "নামজারি করতে কী কী লাগবে আর খরচ কত?" }],
      provider: model,
      registry,
    });
    expect(res.reply).toContain("১,১৭০");
    expect(res.reply).toContain("সূত্র:");
    expect(res.sources.map((s) => s.law_id)).toEqual(
      expect.arrayContaining(["mutation-fee", "sat-1950-s143"]),
    );
    expect(res.sources.find((s) => s.law_id === "sat-1950-s143")!.section).toBe("143");
  });

  it("a question with no source gets the refusal and no sources", async () => {
    const model = new ScriptedProvider([
      () => ({ content: [toolUse("t1", "law_search", { query: "আজ ঢাকার আবহাওয়া কেমন" })], stop_reason: "tool_use" }), // prettier-ignore
      (req) => {
        expect(lastToolResults(req)[0]!.data).toEqual([]);
        return {
          content: [text(`${REFUSAL} প্রয়োজনে ১৬১২২ নম্বরে কল করুন।`)],
          stop_reason: "end_turn",
        };
      },
    ]);
    const res = await runAgent({
      messages: [{ role: "user", content: "আজ ঢাকার আবহাওয়া কেমন?" }],
      provider: model,
      registry,
    });
    expect(res.reply).toContain(REFUSAL);
    expect(res.sources).toEqual([]);
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { runAgent } from "@/lib/ai/agent";
import type { ModelProvider } from "@/lib/ai/provider";
import { cachedMouzas } from "@/lib/engines/mouzas";
import { closeSql } from "@/lib/sql";

// Phase A: the commonest questions are answered from the tools without calling the model.

afterAll(() => closeSql());

/** A model that must not be called for fast questions. */
const noModel: ModelProvider = {
  name: "no-model",
  send: async () => {
    throw new Error("the model was called");
  },
} as unknown as ModelProvider;

const ask = (q: string, lang: "bn" | "en" = "bn", provider = noModel) =>
  runAgent({
    messages: [{ role: "user", content: q }],
    provider,
    replyLanguage: lang,
    fastPath: { mouzas: cachedMouzas },
  });

describe("fast path", () => {
  it("checks a dag from the number alone (spoken as words), with no model call", async () => {
    const t0 = performance.now();
    const res = await ask("একশো পঁয়তাল্লিশ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও");
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(res.stopReason).toBe("fast_path");
    expect(res.toolCalls.map((c) => c.name)).toEqual(["find_dag", "jomi_check"]);
    expect(res.reply).toMatch(/^ফলাফল: (লাল|হলুদ|সবুজ)/);
    expect(res.reply).toContain("দাগ ১৪৫");
    expect(res.messages.at(-1)).toEqual({ role: "assistant", content: res.reply });
  });

  it("uses a mouza named in the question, even misspelled, and answers in English", async () => {
    const res = await ask("Is dag 141 in Nayapaara safe to buy?", "en");
    expect(res.toolCalls.map((c) => c.name)).toEqual(["jomi_check"]);
    expect(res.reply).toContain("Result:");
    expect(res.reply).toContain("Nayapara, dag 141");
  });

  it("measures a dag's area", async () => {
    const res = await ask("১৪৫ নম্বর দাগের মাপ কত?");
    expect(res.toolCalls.map((c) => c.name)).toEqual(["find_dag", "map_area"]);
    expect(res.reply).toContain("প্রায় ২০.০৪ শতক");
    expect(res.reply).toContain("মিলেছে");
  });

  it("converts units, showing every regional kani size", async () => {
    const res = await ask("২ কানি ৫ গন্ডা কত শতক?");
    expect(res.toolCalls.map((c) => c.name)).toEqual(["unit_convert"]);
    expect(res.reply).toContain("কানির মাপ এলাকাভেদে ভিন্ন");
    expect(res.reply).toContain("২৭০");
  });

  it("says so when a dag number is not in the records", async () => {
    const res = await ask("৯৯৯৯ নম্বর দাগ যাচাই করুন");
    expect(res.reply).toContain("কোনো মৌজায় পাওয়া যায়নি");
  });

  it("leaves legal and write questions to the model", async () => {
    await expect(ask("নামজারি করতে কত টাকা ফি লাগে?")).rejects.toThrow("the model was called");
    await expect(ask("রহিমের ১৪৫ নম্বর দাগে সালমার নামে ১০ শতক বায়না")).rejects.toThrow(
      "the model was called",
    );
  });

  it("is off unless asked for", async () => {
    await expect(
      runAgent({ messages: [{ role: "user", content: "১৪৫ নম্বর দাগ" }], provider: noModel }),
    ).rejects.toThrow("the model was called");
  });
});

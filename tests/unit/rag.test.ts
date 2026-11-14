import { describe, expect, it } from "vitest";
import { buildChunks, loadLawDocs, loadQa } from "@/lib/ai/laws";
import { keywordScores, MIN_SCORE, searchLaws, tokenize } from "@/lib/ai/rag";
import type { Embedder } from "@/lib/ai/embeddings";

// Keyword mode only (embedder: null) so these tests need no network.
const search = (q: string) => searchLaws(q, { embedder: null });

describe("law library", () => {
  it("every law file has its citation fields and an official source", () => {
    const docs = loadLawDocs();
    expect(docs.length).toBeGreaterThanOrEqual(11);
    for (const d of docs) {
      expect(d.source).toMatch(/^https?:\/\//);
      expect(d.verified.length).toBeGreaterThan(10);
      expect(d.body).toMatch(/[ঀ-৿]/); // has Bangla
    }
  });

  it("every Q&A item cites law ids that exist", () => {
    expect(() => buildChunks()).not.toThrow();
    expect(loadQa().length).toBeGreaterThanOrEqual(30);
  });

  it("the mutation fee file adds up to Tk 1,170", () => {
    const fee = loadLawDocs().find((d) => d.id === "mutation-fee")!;
    expect(fee.body).toContain("১,১৭০");
    expect(20 + 50 + 1000 + 100).toBe(1170);
  });
});

describe("keyword search", () => {
  it("tokenizes Bangla, drops filler words, reads Bangla digits", () => {
    expect(tokenize("নামজারি করতে কী কী লাগবে আর খরচ কত?")).toEqual(["নামজারি", "খরচ"]);
    expect(tokenize("১৪৫ নম্বর দাগ")).toEqual(["145", "নম্বর", "দাগ"]);
  });

  it("G6: the mutation question finds the fee schedule and SAT Act s.143", async () => {
    const hits = await search("নামজারি করতে কী কী লাগবে আর খরচ কত?");
    const ids = hits.map((h) => h.law_id);
    expect(ids[0]).toBe("mutation-fee");
    expect(ids).toContain("sat-1950-s143");
    expect(hits[0]!.source).toContain("bssnews");
  });

  it("matches Bangla word endings (নামজারির → নামজারি)", async () => {
    const hits = await search("নামজারির ফি");
    expect(hits[0]!.law_id).toBe("mutation-fee");
  });

  it("finds the right section for other questions", async () => {
    expect((await search("একই জমি দুইবার বিক্রি করলে শাস্তি"))[0]!.law_id).toBe("lcpra-2023-s4");
    expect((await search("বায়না রেজিস্ট্রি কত দিনের মধ্যে"))[0]!.law_id).toBe(
      "registration-1908-s17a",
    );
    expect((await search("দাদার আগে বাবা মারা গেছেন, নাতি কি অংশ পাবে"))[0]!.law_id).toBe(
      "mflo-1961-s4",
    );
    expect((await search("How much is the mutation fee?"))[0]!.law_id).toBe("mutation-fee");
  });

  it("returns nothing for a question the library does not cover (→ refusal)", async () => {
    expect(await search("আজ ঢাকার আবহাওয়া কেমন?")).toEqual([]);
    expect(await search("ছেলেকে স্কুলে ভর্তির নিয়ম কী?")).toEqual([]);
    expect(await search("What is the capital of France?")).toEqual([]);
  });

  it("scores stay between 0 and 1", () => {
    for (const s of keywordScores("নামজারি খরচ বায়না").values()) {
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(MIN_SCORE).toBeGreaterThan(0);
  });
});

describe("semantic search (fake embedder)", () => {
  it("embeddings can lift a law that shares no keywords with the question", async () => {
    // A fake 2-d embedding space: the query and the 'possession' law point the same way.
    const vectors = new Map<string, number[]>();
    for (const c of buildChunks())
      vectors.set(c.id, c.id === "law:lcpra-2023-s7-8" ? [1, 0] : [0, 1]);
    const embedder: Embedder = { model: "fake", embed: async () => [[1, 0]] };
    const hits = await searchLaws("প্রতিবেশী জোর করে আমার উঠানে ঘর তুলেছে", { embedder, vectors });
    expect(hits[0]!.law_id).toBe("lcpra-2023-s7-8");
  });

  it("falls back to keywords if the embedding call fails", async () => {
    const embedder: Embedder = { model: "fake", embed: async () => { throw new Error("offline"); } }; // prettier-ignore
    const vectors = new Map([["law:mutation-fee", [1]]]);
    const hits = await searchLaws("নামজারি খরচ", { embedder, vectors });
    expect(hits[0]!.law_id).toBe("mutation-fee");
  });
});

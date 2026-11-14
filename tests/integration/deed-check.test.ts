import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveUpload, UploadError } from "@/lib/adapters/storage";
import { MOCK_DEED_4512, type DeedExtract } from "@/lib/ai/vision";
import { checkDeed } from "@/lib/engines/deed-check";
import { runTool as runToolAs, SYSTEM } from "@/lib/tools/registry";
import { closeSql, getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";

// Trusted test caller (no HTTP request, no role check).
const runTool = (name: string, input: unknown) => runToolAs(name, input, SYSTEM);

const sql = getSql();
beforeAll(() => seed(sql));
afterAll(() => closeSql());

const codes = (r: Awaited<ReturnType<typeof checkDeed>>) => r.findings.map((f) => f.code);
const deed = (patch: Partial<DeedExtract>): DeedExtract => ({ ...MOCK_DEED_4512, ...patch });

describe("G3: deed 4512/2024 cross-checked with the records", () => {
  it("AMBER: the khatian records 3 dec more than the map → verify the boundary with an amin", async () => {
    const r = await checkDeed(MOCK_DEED_4512);
    expect(r.verdict).toBe("amber");
    expect(codes(r)).toEqual(expect.arrayContaining(["MAP_MISMATCH", "MUTATION_PENDING"]));
    expect(r.findings.find((f) => f.code === "MAP_MISMATCH")!.bn).toContain(
      "আমিন দিয়ে সীমানা যাচাই করুন",
    );
    expect(codes(r)).not.toContain("DEED_DETAILS_DIFFER"); // the fields match the registry
    expect(r.dag).toEqual({ mouza_bn: "নয়াপাড়া", mouza_en: "Nayapara", dag_no: 143 });
  });

  it("the real model's misread date (18 May instead of 14) is flagged, the 'মো:' spelling is not", async () => {
    const r = await checkDeed(deed({ registered_on: "2024-05-18", seller_name: "মো: রহিম উদ্দিন" }));
    const diff = r.findings.find((f) => f.code === "DEED_DETAILS_DIFFER")!;
    expect(diff.bn).toContain("তারিখ (রেকর্ডে ১৪/০৫/২০২৪)");
    expect(diff.bn).not.toContain("বিক্রেতা");
  });

  it("RED when the deed transfers more than the seller holds (Land Crime Act s.4)", async () => {
    const r = await checkDeed(deed({ area_dec: 30 }));
    expect(r.verdict).toBe("red");
    expect(codes(r)).toContain("MORE_THAN_SHARE");
  });

  it("RED when the seller is not on the latest khatian, or the khatian number is wrong", async () => {
    expect(codes(await checkDeed(deed({ seller_name: "জামাল মিয়া" })))).toContain(
      "SELLER_NOT_RECORDED",
    );
    expect(codes(await checkDeed(deed({ khatian_no: 999 })))).toContain("KHATIAN_MISMATCH");
  });

  it("an unknown deed number is amber; a non-deed or unknown dag is red", async () => {
    expect(codes(await checkDeed(deed({ deed_no: "9999/2025" })))).toContain(
      "DEED_NOT_IN_REGISTRY",
    );
    expect((await checkDeed(deed({ is_deed: false }))).verdict).toBe("red");
    expect(codes(await checkDeed(deed({ dag_no: 9999 })))).toContain("DAG_NOT_FOUND");
  });

  it("a mouza spelling variant falls back to the JL number", async () => {
    const r = await checkDeed(deed({ mouza: "নয়া পাড়া" }));
    expect(r.dag?.dag_no).toBe(143);
  });
});

describe("deed_read tool (mock vision) with private storage", () => {
  it("reads the sample image end to end", async () => {
    process.env.AI_PROVIDER = "mock";
    const { id } = await saveUpload(readFileSync("content/deeds/deed-4512.png"));
    const r = (await runTool("deed_read", { upload_id: id })) as {
      verdict: string;
      summary_bn: string;
    };
    expect(r.verdict).toBe("amber");
    expect(r.summary_bn).toContain("৮ শতক");
  });

  it("refuses a file that is not an image", async () => {
    await expect(saveUpload(Buffer.from("not an image at all"))).rejects.toThrow(UploadError);
  });
});

import { describe, expect, it } from "vitest";
import { detectIntent, editDistance, findAmounts, findDagNumber, findMouza } from "@/lib/ai/intent";

const MOUZAS = [
  { name_bn: "নয়াপাড়া", name_en: "Nayapara" },
  { name_bn: "চরকান্দি", name_en: "Charkandi" },
];

describe("fast intent detection", () => {
  it.each([
    ["১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও", { kind: "check", dag_no: 145, mouza: null }],
    ["একশো পঁয়তাল্লিশ নম্বর দাগ", { kind: "check", dag_no: 145, mouza: null }],
    ["নয়াপাড়ার দাগ ১৪২ যাচাই করুন", { kind: "check", dag_no: 142, mouza: "Nayapara" }],
    ["নয়াপারা মৌজার ১৪৯ নম্বর দাগ চেক করো", { kind: "check", dag_no: 149, mouza: "Nayapara" }],
    ["Is dag 141 in Nayapara safe to buy?", { kind: "check", dag_no: 141, mouza: "Nayapara" }],
    ["১৪৫ নম্বর দাগের মাপ কত?", { kind: "area", dag_no: 145, mouza: null }],
    ["What is the area of plot 145?", { kind: "area", dag_no: 145, mouza: null }],
  ])("%s", (q, expected) => {
    expect(detectIntent(q, MOUZAS)).toEqual(expected);
  });

  it("converts units", () => {
    expect(detectIntent("২ কানি ৫ গন্ডা কত শতক?", MOUZAS)).toEqual({
      kind: "units",
      amounts: [
        { value: 2, unit: "kani" },
        { value: 5, unit: "gonda" },
      ],
    });
    expect(detectIntent("how many decimals is 3 bigha", MOUZAS)).toEqual({
      kind: "units",
      amounts: [{ value: 3, unit: "bigha" }],
    });
  });

  it.each([
    "নামজারি করতে কত টাকা ফি লাগে?",
    "রহিমের ১৪৫ নম্বর দাগে সালমার নামে ১০ শতক বায়না",
    "১৪৫ নম্বর দাগ কেন লাল?",
    "আমার বাবা মারা গেছেন, ওয়ারিশ হিসাব করুন",
    "১৪৫ নম্বর দাগের মালিক কে?",
    "খতিয়ান ১২ এর দাগগুলো কী?",
    "হ্যালো",
  ])("leaves '%s' to the model", (q) => {
    expect(detectIntent(q, MOUZAS)).toBeNull();
  });

  it("finds dag numbers in many shapes", () => {
    expect(findDagNumber("145 নং দাগ")).toBe(145);
    expect(findDagNumber("দাগ নম্বর: 210")).toBe(210);
    expect(findDagNumber("dag no. 7")).toBe(7);
    expect(findDagNumber("10 শতক জমি")).toBeNull();
  });

  it("matches close mouza spellings but not unrelated words", () => {
    expect(findMouza("নয়াপারা", MOUZAS)?.name_en).toBe("Nayapara");
    expect(findMouza("charkandy", MOUZAS)?.name_en).toBe("Charkandi");
    expect(findMouza("জমি কেনা নিরাপদ", MOUZAS)).toBeNull();
    expect(editDistance("kitten", "sitting")).toBe(3);
  });

  it("reads amounts with units", () => {
    expect(findAmounts("10.5 শতক আর 2 কাঠা")).toEqual([
      { value: 10.5, unit: "decimal" },
      { value: 2, unit: "katha" },
    ]);
  });
});

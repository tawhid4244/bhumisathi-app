import { describe, expect, it } from "vitest";
import { normalizeTranscript, wordsToDigits } from "@/lib/ai/bn-numbers";

describe("Bangla number words → digits", () => {
  it.each([
    ["একশো পঁয়তাল্লিশ নম্বর দাগ", "145 নম্বর দাগ"],
    ["দাগ নম্বর একশ পঁয়তাল্লিশ", "দাগ নম্বর 145"],
    ["দুইশো দশ নম্বর দাগের মালিক কে", "210 নম্বর দাগের মালিক কে"],
    ["দুশো এগারো নং দাগ", "211 নং দাগ"],
    ["সাড়ে দশ শতক", "10.5 শতক"],
    ["দেড় কানি", "1.5 কানি"],
    ["আড়াই বিঘা", "2.5 বিঘা"],
    ["দুই কানি পাঁচ গন্ডা", "2 কানি 5 গন্ডা"],
    ["এক হাজার দুইশো টাকা", "1200 টাকা"],
    ["চল্লিশ শতক", "40 শতক"],
  ])("%s → %s", (spoken, expected) => {
    expect(wordsToDigits(spoken)).toBe(expected);
  });

  it("keeps ordinary words that happen to be number words", () => {
    expect(wordsToDigits("এই জমি কেনা নিরাপদ নয়")).toBe("এই জমি কেনা নিরাপদ নয়");
    expect(wordsToDigits("এক জমি, এক সত্য")).toBe("এক জমি, এক সত্য");
    expect(wordsToDigits("তিন বার বলেছি")).toBe("তিন বার বলেছি");
  });

  it("leaves digits alone and turns Bangla digits into Western ones", () => {
    expect(normalizeTranscript("১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও")).toBe(
      "145 নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও",
    );
    expect(normalizeTranscript("dag 145 in Nayapara")).toBe("dag 145 in Nayapara");
  });

  it("accepts both Unicode spellings of য়", () => {
    const decomposed = "পঁয়তাল্লিশ নম্বর দাগ"; // য + nukta
    expect(wordsToDigits(decomposed)).toBe("45 নম্বর দাগ");
  });
});

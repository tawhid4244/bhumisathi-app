import { describe, expect, it } from "vitest";
import {
  bestTranscript,
  extractNumbers,
  readBackQuestion,
  speakable,
  toBnDigits,
} from "@/lib/voice";

describe("voice: numbers heard", () => {
  it("reads Bangla and English digits, keeps decimals", () => {
    expect(extractNumbers("১৪৫ নম্বর দাগে ১০.৫ শতক")).toEqual([145, 10.5]);
    expect(extractNumbers("dag 145")).toEqual([145]);
    expect(extractNumbers("নামজারি খরচ কত")).toEqual([]);
  });
});

describe("voice: read-back before acting", () => {
  it("G8: asks about the dag number in Bangla", () => {
    expect(readBackQuestion("১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও", "bn")).toBe(
      "আপনি কি ১৪৫ নম্বর দাগ বলেছেন? ঠিক আছে?",
    );
    expect(readBackQuestion("দাগ নং 145 দেখাও", "bn")).toBe(
      "আপনি কি ১৪৫ নম্বর দাগ বলেছেন? ঠিক আছে?",
    );
  });

  it("several numbers are all read back", () => {
    expect(readBackQuestion("১৪৫ নম্বর দাগে সালমার নামে ১০ শতক বায়না", "bn")).toBe(
      "আপনি কি এই সংখ্যাগুলো বলেছেন: ১৪৫, ১০? ঠিক আছে?",
    );
  });

  it("English", () => {
    expect(readBackQuestion("Is dag 145 safe to buy?", "en")).toBe(
      "Did you say dag 145? Is that right?",
    );
  });

  it("no numbers → nothing to confirm, send straight away", () => {
    expect(readBackQuestion("নামজারি করতে কী কী লাগবে", "bn")).toBeNull();
  });
});

describe("voice: speakable text", () => {
  it("removes markdown and links", () => {
    expect(speakable("**ফলাফল:** সবুজ\n- কারণ এক\nসূত্র: https://bdlaws.minlaw.gov.bd/x")).toBe(
      "ফলাফল: সবুজ\nকারণ এক\nসূত্র:",
    );
  });

  it("cuts long answers at a sentence end", () => {
    const long = `${"ক".repeat(400)}। ${"খ".repeat(400)}।`;
    expect(speakable(long, 600)).toBe(`${"ক".repeat(400)}।`);
  });

  it("Bangla digits", () => {
    expect(toBnDigits("145")).toBe("১৪৫");
  });
});

describe("best of several speech guesses", () => {
  it("turns spoken number words into digits", () => {
    expect(bestTranscript([{ transcript: "একশো পঁয়তাল্লিশ নম্বর দাগ" }], "bn")).toBe("১৪৫ নম্বর দাগ");
    expect(bestTranscript([{ transcript: "dag 145" }], "en")).toBe("dag 145");
  });

  it("prefers a guess with a dag number over a mis-heard top guess", () => {
    const alts = [
      { transcript: "১৪৫ নম্বর ডাক কেনা নিরাপদ", confidence: 0.7 },
      { transcript: "১৪৫ নম্বর দাগ কেনা নিরাপদ", confidence: 0.6 },
    ];
    expect(bestTranscript(alts, "bn")).toBe("১৪৫ নম্বর দাগ কেনা নিরাপদ");
  });

  it("keeps the top guess when it has no numbers", () => {
    expect(bestTranscript([{ transcript: "নামজারির ফি কত" }, { transcript: "১ দাগ" }], "bn")).toBe(
      "নামজারির ফি কত",
    );
  });

  it("reads back numbers that were spoken as words", () => {
    expect(readBackQuestion("একশো পঁয়তাল্লিশ নম্বর দাগ", "bn")).toBe(
      "আপনি কি ১৪৫ নম্বর দাগ বলেছেন? ঠিক আছে?",
    );
  });
});

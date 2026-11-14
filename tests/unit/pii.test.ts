import { describe, expect, it } from "vitest";
import { createMasker, maskDeep } from "@/lib/ai/pii";

const names = [["মোঃ রহিম উদ্দিন", "রহিম উদ্দিন", "Md. Rahim Uddin"], ["সালমা আক্তার"]];

describe("PII masker", () => {
  it("masks synthetic and real-looking NIDs (English and Bangla digits)", () => {
    const m = createMasker();
    const out = m.mask(
      "NID SYN-0000-0001, পুরনো 1990123456789, নতুন ১৯৯০১২৩৪৫৬, স্মার্ট 19901234567890123",
    );
    expect(out).toBe("NID [NID-১], পুরনো [NID-২], নতুন [NID-৩], স্মার্ট [NID-৪]");
  });

  it("masks phone numbers in common forms", () => {
    const m = createMasker();
    expect(m.mask("ফোন 01712345678 বা +8801812-345-678 বা ০১৯১২৩৪৫৬৭৮ বা +880-SYN-0001")).toBe(
      "ফোন [ফোন-১] বা [ফোন-২] বা [ফোন-৩] বা [ফোন-৪]",
    );
  });

  it("does not mask dag numbers, areas, years or money", () => {
    const m = createMasker();
    const t = "দাগ ১৪৫, ২০ শতক, ২০২৪ সাল, ১,১৭০ টাকা, khatian 210";
    expect(m.mask(t)).toBe(t);
  });

  it("all spellings of one person share a placeholder (full, short, English)", () => {
    const m = createMasker(names);
    expect(m.mask("মোঃ রহিম উদ্দিন সালমা আক্তারকে বায়না দিলেন; রহিম উদ্দিন রাজি")).toBe(
      "[ব্যক্তি-১] [ব্যক্তি-২]কে বায়না দিলেন; [ব্যক্তি-১] রাজি",
    );
    expect(m.mask("আবার মোঃ রহিম উদ্দিন, again Md. Rahim Uddin")).toBe(
      "আবার [ব্যক্তি-১], again [ব্যক্তি-১]",
    );
    // Unmask gives the main (record) spelling.
    expect(m.unmask("[ব্যক্তি-১]")).toBe("মোঃ রহিম উদ্দিন");
  });

  it("unmask restores the original values", () => {
    const m = createMasker(names);
    const original = "মোঃ রহিম উদ্দিন, NID SYN-0000-0001, ফোন 01712345678";
    const masked = m.mask(original);
    expect(masked).not.toContain("রহিম");
    expect(m.unmask(masked)).toBe(original);
    expect(m.unmask("উত্তর: [ব্যক্তি-১]-এর জমি সবুজ")).toBe("উত্তর: মোঃ রহিম উদ্দিন-এর জমি সবুজ");
  });

  it("maskDeep keeps signatures and ids untouched", () => {
    const m = createMasker(names);
    const block = { type: "tool_use", id: "01712345678", signature: "SYN-0000-0001", input: { note: "SYN-0000-0001" } }; // prettier-ignore
    expect(maskDeep(block, m)).toEqual({ ...block, input: { note: "[NID-১]" } });
  });
});

describe("name groups from the records", () => {
  it("every title spelling maps to the same placeholder and unmasks cleanly (real-run bug)", async () => {
    const { nameGroup } = await import("@/lib/ai/pii");
    const m = createMasker([nameGroup("মোঃ রহিম উদ্দিন", "Md. Rahim Uddin")]);
    const masked = m.mask(
      "দলিলে লেখা: মো: রহিম উদ্দিন; খতিয়ানে মোঃ রহিম উদ্দিন; ইংরেজিতে Md Rahim Uddin",
    );
    expect(masked).toBe("দলিলে লেখা: [ব্যক্তি-১]; খতিয়ানে [ব্যক্তি-১]; ইংরেজিতে [ব্যক্তি-১]");
    expect(m.unmask("[ব্যক্তি-১] বিক্রেতা")).toBe("মোঃ রহিম উদ্দিন বিক্রেতা");
  });
});

import { describe, expect, it } from "vitest";
import { readUpload, sniffImage, UploadError } from "@/lib/adapters/storage";
import { SYSTEM } from "@/lib/tools/types";
import { MOCK_DEED_4512 } from "@/lib/ai/vision";
import { deedSummary, normalizeName, sameName } from "@/lib/engines/deed-check";

describe("deed reader helpers", () => {
  it("compares names regardless of title spelling", () => {
    expect(sameName("মো: রহিম উদ্দিন", "মোঃ রহিম উদ্দিন")).toBe(true); // what the real model returned
    expect(sameName("রহিম উদ্দিন", "মোঃ রহিম উদ্দিন")).toBe(true);
    expect(sameName("Md. Rahim Uddin", "md rahim uddin")).toBe(true);
    expect(sameName("করিম হোসেন", "মোঃ রহিম উদ্দিন")).toBe(false);
    expect(normalizeName("মোহাম্মদ  রহিম")).toBe("মো রহিম");
  });

  it("writes a plain-Bangla summary only from the fields read", () => {
    expect(deedSummary(MOCK_DEED_4512)).toBe(
      "এটি একটি সাফ কবলা (বিক্রয়) দলিল (নং ৪৫১২/২০২৪)। ১৪/০৫/২০২৪ তারিখে রেজিস্ট্রি হয়েছে। মোঃ রহিম উদ্দিন নয়াপাড়া মৌজার ১৪৩ নম্বর দাগের ৮ শতক জমি করিম হোসেন-এর কাছে ১৬,০০,০০০ টাকায় হস্তান্তর করেছেন। দলিলে BS খতিয়ান ২১০ উল্লেখ আছে।",
    );
    expect(deedSummary({ ...MOCK_DEED_4512, is_deed: false })).toContain("দলিল বলে মনে হচ্ছে না");
  });

  it("accepts only real images by their bytes", () => {
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      "image/png",
    );
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(sniffImage(Buffer.from("%PDF-1.7"))).toBeNull();
  });

  it("refuses upload ids that could reach other files", async () => {
    await expect(readUpload("../.env.local", SYSTEM)).rejects.toThrow(UploadError);
    await expect(readUpload("ZZZZZZZZZZZZZZZZZZZZZZZZ", SYSTEM)).rejects.toThrow(UploadError);
  });
});

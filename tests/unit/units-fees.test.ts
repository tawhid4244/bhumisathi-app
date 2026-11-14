import { describe, expect, it } from "vitest";
import { feeGuide, listFees } from "@/lib/engines/fees";
import { convertUnits } from "@/lib/engines/units";

describe("unit converter", () => {
  it("concept-note example: 2 kani 5 gonda → 90 dec at 40, 270 dec at 120 (shown side by side)", () => {
    const r = convertUnits([
      { value: 2, unit: "kani" },
      { value: 5, unit: "gonda" },
    ]);
    expect(r.uses_kani).toBe(true);
    const at = (k: number) => r.variants.find((v) => v.kani_dec === k)!.units;
    expect(at(40)).toMatchObject({ decimals: 90, acre: 0.9, sqft: 39204, kani: 2.25 });
    expect(at(120)).toMatchObject({ decimals: 270, acre: 2.7, sqft: 117612, kani: 2.25 });
    expect(r.variants.map((v) => v.kani_dec)).toEqual([120, 40, 30]);
    expect(r.rules_bn.join(" ")).toContain("কানির মাপ এলাকাভেদে ভিন্ন");
  });

  it("a local kani size gives one answer and says it was the user's", () => {
    const r = convertUnits([{ value: 1, unit: "kani" }], { kaniDec: 40 });
    expect(r.variants).toHaveLength(1);
    expect(r.variants[0]!.units.decimals).toBe(40);
    expect(r.rules_bn.join(" ")).toContain("কানি ধরা হয়েছে ৪০ শতক (আপনার দেওয়া)");
  });

  it("kani family: 1 kani = 20 gonda = 80 kora = 240 kranti", () => {
    const one = (unit: "gonda" | "kora" | "kranti", value: number) =>
      convertUnits([{ value, unit }], { kaniDec: 120 }).variants[0]!.units.decimals;
    expect(one("gonda", 20)).toBe(120);
    expect(one("kora", 80)).toBe(120);
    expect(one("kranti", 240)).toBe(120);
  });

  it("standard units: 1 bigha = 20 katha ≈ 33.06 dec; 1 acre = 100 dec; 1 decimal = 435.6 sq ft", () => {
    const b = convertUnits([{ value: 1, unit: "bigha" }]).variants[0]!.units;
    expect(b).toMatchObject({ decimals: 33.06, katha: 20, sqft: 14400, kani: null });
    expect(convertUnits([{ value: 1, unit: "acre" }]).variants[0]!.units.decimals).toBe(100);
    expect(convertUnits([{ value: 435.6, unit: "sqft" }]).variants[0]!.units.decimals).toBe(1);
    expect(convertUnits([{ value: 1, unit: "hectare" }]).variants[0]!.units.acre).toBeCloseTo(
      2.4711,
      4,
    );
  });

  it("a local bigha size is used and stated", () => {
    const r = convertUnits([{ value: 2, unit: "bigha" }], { bighaDec: 30 });
    expect(r.variants[0]!.units.decimals).toBe(60);
    expect(r.rules_bn.join(" ")).toContain("বিঘা ধরা হয়েছে ৩০ শতক (আপনার দেওয়া)");
  });

  it("rejects bad input", () => {
    expect(() => convertUnits([])).toThrow();
    expect(() => convertUnits([{ value: -1, unit: "decimal" }])).toThrow();
  });
});

describe("fee guide", () => {
  it("mutation total is Tk 1,170 = 20 + 50 + 1,000 + 100, with a source", () => {
    const m = feeGuide("mutation")!;
    expect(m.items.map((i) => i.tk)).toEqual([20, 50, 1000, 100]);
    expect(m.total_tk).toBe(1170);
    expect(m.source).toContain("bssnews");
    expect(m.verified).toMatch(/Confirm locally/);
  });

  it("finds services by the words people use", () => {
    expect(feeGuide("নামজারি করতে কত")!.id).toBe("mutation");
    expect(feeGuide("জমাখারিজ")!.id).toBe("mutation");
    expect(feeGuide("মৌজা ম্যাপ")!.id).toBe("mouza_map");
    expect(feeGuide("দলিল রেজিস্ট্রি")!.id).toBe("registration");
    expect(feeGuide("আবহাওয়া")).toBeNull();
  });

  it("every service has a source and a verification note; registration lists no invented rates", () => {
    for (const s of listFees()) {
      expect(s.source.length).toBeGreaterThan(10);
      expect(s.verified.length).toBeGreaterThan(10);
    }
    const reg = feeGuide("registration")!;
    expect(reg.items).toEqual([]);
    expect(reg.total_tk).toBeNull();
    expect(reg.components_bn).toContain("স্ট্যাম্প শুল্ক");
  });

  it("other fees from the land service list", () => {
    expect(feeGuide("certified_khatian")!.total_tk).toBe(140);
    expect(feeGuide("online_khatian")!.total_tk).toBe(100);
    expect(feeGuide("mouza_map")!.items[0]!.tk).toBe(520);
  });
});

import { describe, expect, it } from "vitest";
import { Fraction } from "@/lib/engines/fraction";
import { computeWarish, decimalsOf, WarishInputError, type Family } from "@/lib/engines/warish";

/** key → fraction string, e.g. { wife: "1/8", "son-1": "7/20" } */
function shares(f: Family): Record<string, string> {
  return Object.fromEntries(computeWarish(f).shares.map((s) => [s.key, s.share.toString()]));
}

describe("fraction", () => {
  it("is exact and reduced", () => {
    expect(new Fraction(2, 4).toString()).toBe("1/2");
    expect(new Fraction(1, 3).add(new Fraction(1, 6)).toString()).toBe("1/2");
    expect(new Fraction(1, 3).mul(new Fraction(3, 1)).toString()).toBe("1");
  });
});

describe("G2: Abdul Karim (wife + 2 sons + 1 daughter), Charpara 210 (60 dec) and 211 (40 dec)", () => {
  const r = computeWarish({ wives: 1, sons: 2, daughters: 1 });
  const by = Object.fromEntries(r.shares.map((s) => [s.key, s.share]));

  it("wife 1/8 = 12.5%, each son 7/20 = 35%, daughter 7/40 = 17.5%", () => {
    expect(by.wife!.toString()).toBe("1/8");
    expect(by["son-1"]!.toString()).toBe("7/20");
    expect(by["son-2"]!.toString()).toBe("7/20");
    expect(by.daughter!.toString()).toBe("7/40");
    expect(by.daughter!.toNumber() * 100).toBeCloseTo(17.5, 10);
  });

  it("per dag: 210 → 7.5 / 21 / 21 / 10.5 and 211 → 5 / 14 / 14 / 7", () => {
    expect([by.wife!, by["son-1"]!, by["son-2"]!, by.daughter!].map((s) => decimalsOf(s, 60))).toEqual([7.5, 21, 21, 10.5]); // prettier-ignore
    expect([by.wife!, by["son-1"]!, by["son-2"]!, by.daughter!].map((s) => decimalsOf(s, 40))).toEqual([5, 14, 14, 7]); // prettier-ignore
  });

  it("explains each step in Bangla", () => {
    expect(r.steps_bn.join(" ")).toContain("স্ত্রী: সন্তান থাকায় ১/৮");
    expect(r.steps_bn.join(" ")).toContain("ছেলে ২ : মেয়ে ১");
  });
});

describe("standard cases", () => {
  it("'awl: wife + father + mother + 2 daughters → 3/27, 4/27, 4/27, 16/27", () => {
    const r = computeWarish({ wives: 1, father: true, mother: true, daughters: 2 });
    expect(shares({ wives: 1, father: true, mother: true, daughters: 2 })).toEqual({
      wife: "1/9", // 3/27
      mother: "4/27",
      father: "4/27",
      "daughter-1": "8/27",
      "daughter-2": "8/27", // together 16/27
    });
    expect(r.flags.awl).toBe(true);
  });

  it("radd: mother + 1 daughter → 1/4 and 3/4", () => {
    const r = computeWarish({ mother: true, daughters: 1 });
    expect(shares({ mother: true, daughters: 1 })).toEqual({ mother: "1/4", daughter: "3/4" });
    expect(r.flags.radd).toBe(true);
  });

  it("radd never goes to the spouse while blood heirs exist: husband + 1 daughter → 1/4, 3/4", () => {
    expect(shares({ husband: true, daughters: 1 })).toEqual({ husband: "1/4", daughter: "3/4" });
  });

  it("MFLO s.4: son + predeceased son (1 son, 1 daughter) → 1/2; 1/3; 1/6", () => {
    const r = computeWarish({ sons: 1, predeceasedSons: [{ sons: 1, daughters: 1 }] });
    expect(shares({ sons: 1, predeceasedSons: [{ sons: 1, daughters: 1 }] })).toEqual({
      son: "1/2",
      "pson-1-son": "1/3",
      "pson-1-daughter": "1/6",
    });
    expect(r.flags.mflo).toBe(true);
  });

  it("MFLO s.4: a predeceased daughter's children take a daughter's share", () => {
    expect(shares({ sons: 1, predeceasedDaughters: [{ sons: 0, daughters: 2 }] })).toEqual({
      son: "2/3",
      "pdaughter-1-daughter-1": "1/6",
      "pdaughter-1-daughter-2": "1/6",
    });
  });

  it("a predeceased child with no children is not counted", () => {
    expect(shares({ sons: 1, predeceasedSons: [{ sons: 0, daughters: 0 }] })).toEqual({ son: "1" });
  });

  it("umariyyatayn: husband + mother + father → 1/2, 1/6, 1/3", () => {
    const r = computeWarish({ husband: true, mother: true, father: true });
    expect(shares({ husband: true, mother: true, father: true })).toEqual({ husband: "1/2", mother: "1/6", father: "1/3" }); // prettier-ignore
    expect(r.flags.umariyyatayn).toBe(true);
  });

  it("umariyyatayn: wife + mother + father → 1/4, 1/4, 1/2", () => {
    expect(shares({ wives: 1, mother: true, father: true })).toEqual({ wife: "1/4", mother: "1/4", father: "1/2" }); // prettier-ignore
  });

  it("father with only daughters gets 1/6 plus the residue: 2 daughters + father", () => {
    expect(shares({ daughters: 2, father: true })).toEqual({ father: "1/3", "daughter-1": "1/3", "daughter-2": "1/3" }); // prettier-ignore
  });

  it("father + son → 1/6 and 5/6", () => {
    expect(shares({ father: true, sons: 1 })).toEqual({ father: "1/6", son: "5/6" });
  });

  it("husband + son + daughter → 1/4, 1/2, 1/4", () => {
    expect(shares({ husband: true, sons: 1, daughters: 1 })).toEqual({ husband: "1/4", son: "1/2", daughter: "1/4" }); // prettier-ignore
  });

  it("two wives share 1/8 equally with a son: 1/16, 1/16, 7/8", () => {
    expect(shares({ wives: 2, sons: 1 })).toEqual({
      "wife-1": "1/16",
      "wife-2": "1/16",
      son: "7/8",
    });
  });

  it("'awl with sisters: husband + 2 full sisters → 3/7, 2/7, 2/7", () => {
    expect(shares({ husband: true, fullSisters: 2 })).toEqual({ husband: "3/7", "sister-1": "2/7", "sister-2": "2/7" }); // prettier-ignore
  });

  it("two siblings reduce the mother to 1/6: mother + 2 brothers → 1/6, 5/12, 5/12", () => {
    expect(shares({ mother: true, fullBrothers: 2 })).toEqual({ mother: "1/6", "brother-1": "5/12", "brother-2": "5/12" }); // prettier-ignore
  });

  it("a sister takes the residue with a daughter: wife + daughter + sister → 1/8, 1/2, 3/8", () => {
    expect(shares({ wives: 1, daughters: 1, fullSisters: 1 })).toEqual({ wife: "1/8", daughter: "1/2", sister: "3/8" }); // prettier-ignore
  });

  it("a son excludes brothers and sisters", () => {
    const r = computeWarish({ sons: 1, fullBrothers: 2, fullSisters: 1 });
    expect(r.shares.map((s) => s.key)).toEqual(["son"]);
    expect(r.steps_bn.join(" ")).toContain("ভাইবোন: ছেলে থাকায় তাঁরা অংশ পান না");
  });

  it("only a daughter takes everything (1/2 + radd)", () => {
    expect(shares({ daughters: 1 })).toEqual({ daughter: "1" });
  });

  it("only a wife takes everything (no other heir)", () => {
    const r = computeWarish({ wives: 1 });
    expect(shares({ wives: 1 })).toEqual({ wife: "1" });
    expect(r.flags.spouseRadd).toBe(true);
  });
});

describe("input safety", () => {
  it("rejects impossible families", () => {
    expect(() => computeWarish({})).toThrow(WarishInputError);
    expect(() => computeWarish({ husband: true, wives: 1 })).toThrow(WarishInputError);
    expect(() => computeWarish({ wives: 5 })).toThrow(WarishInputError);
    expect(() => computeWarish({ sons: -1 })).toThrow(WarishInputError);
  });

  it("every family's shares add up to exactly 1 (checked over many combinations)", () => {
    let checked = 0;
    for (const spouse of [{}, { husband: true }, { wives: 1 }, { wives: 3 }])
      for (const father of [false, true])
        for (const mother of [false, true])
          for (const sons of [0, 1, 3])
            for (const daughters of [0, 1, 2])
              for (const fullBrothers of [0, 2])
                for (const fullSisters of [0, 1, 3]) {
                  const fam: Family = { ...spouse, father, mother, sons, daughters, fullBrothers, fullSisters }; // prettier-ignore
                  try {
                    const total = Fraction.sum(computeWarish(fam).shares.map((s) => s.share));
                    expect(total.toString()).toBe("1");
                    checked++;
                  } catch (e) {
                    expect(e).toBeInstanceOf(WarishInputError); // only "no heirs"
                  }
                }
    expect(checked).toBeGreaterThan(800);
  });
});

describe("English explanations (for the English screen)", () => {
  const families = [
    { wives: 1, sons: 2, daughters: 1 },
    { husband: true, father: true, mother: true },
    { wives: 1, father: true, mother: true, daughters: 2 },
    { mother: true, daughters: 1 },
    { wives: 1 },
    { fullBrothers: 1, fullSisters: 2 },
    { sons: 1, predeceasedDaughters: [{ sons: 1, daughters: 1 }] },
  ];
  it("every step and every basis has an English line with no Bangla in it", () => {
    for (const f of families) {
      const r = computeWarish(f);
      expect(r.steps_en).toHaveLength(r.steps_bn.length);
      for (const line of [...r.steps_en, ...r.shares.map((s) => s.basis_en)]) {
        expect(line).not.toMatch(/[ঀ-৿]/);
        expect(line.length).toBeGreaterThan(3);
      }
    }
  });
});

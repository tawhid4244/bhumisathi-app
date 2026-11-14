import { describe, expect, it } from "vitest";
import type { DagFacts } from "@/lib/engines/records";
import { bn, evaluate, fiscalYearStart } from "@/lib/engines/rules";

const today = new Date("2026-11-14T00:00:00Z");

/** A clean dag: Rahim holds all 20 decimals, tax paid, chain consistent, map matches. */
function clean(): DagFacts {
  return {
    dag: {
      id: 1145,
      mouza_id: 1,
      mouza_bn: "নয়াপাড়া",
      mouza_en: "Nayapara",
      jl_no: 45,
      dag_no: 145,
      recorded_area_dec: 20,
      land_class_bn: "নাল",
      land_class_en: "Nal",
      version: 0,
      is_khas: false,
      pending_cases: null,
    },
    holders: [
      {
        owner_id: 1,
        name_bn: "রহিম",
        name_en: "Rahim",
        is_deceased: false,
        recorded_dec: 20,
        sold_dec: 0,
        reserved_dec: 0,
        locked_dec: 0,
        sellable_dec: 20,
      },
    ],
    chain: (["CS", "SA", "RS", "BS"] as const).map((survey, i) => ({
      survey,
      year: [1915, 1962, 1985, 2015][i]!,
      khatian_no: 10 + i,
      survey_dag_no: 145,
      area_dec: 20,
      owners: [{ name_bn: "রহিম", name_en: "Rahim", share_dec: 20 }],
    })),
    khas: null,
    cases: [],
    liens: [],
    bainas: [],
    unmutated_deeds: [],
    tax: [{ owner_id: 1, name_bn: "রহিম", paid_through_fy: "2026-27" }],
    map_area_dec: 20.04,
    blocked_attempts: [],
  };
}

const codes = (f: DagFacts, ctx = {}) => evaluate(f, { today, ...ctx }).reasons.map((r) => r.code);
const verdict = (f: DagFacts, ctx = {}) => evaluate(f, { today, ...ctx }).verdict;

describe("Jomi Check rules", () => {
  it("clean records → GREEN with a clear message", () => {
    expect(verdict(clean())).toBe("green");
    expect(codes(clean())).toEqual(["CLEAR"]);
  });

  it("G4 khas land → RED", () => {
    const f = { ...clean(), khas: { category_bn: "খাস জলাশয়", category_en: "Khas waterbody" } };
    expect(verdict(f)).toBe("red");
    expect(codes(f)).toContain("KHAS");
  });

  it("G5 pending court case → RED with the case number; disposed case ignored", () => {
    const c = {
      case_no: "101/2025",
      court_bn: "আদালত",
      court_en: "Court",
      summary_bn: "মামলা",
      summary_en: "suit",
    };
    const f = { ...clean(), cases: [{ ...c, status: "pending" }] };
    expect(verdict(f)).toBe("red");
    expect(evaluate(f, { today }).reasons[0]!.en).toContain("101/2025");
    expect(verdict({ ...clean(), cases: [{ ...c, status: "disposed" }] })).toBe("green");
  });

  it("G5 mortgage → AMBER naming the bank", () => {
    const f = { ...clean(), liens: [{ id: "L-0003", area_dec: 5, lender_bn: "ডেমো ব্যাংক", lender_en: "Demo Bank Ltd.", owner_id: 1 }] }; // prettier-ignore
    expect(verdict(f)).toBe("amber");
    expect(evaluate(f, { today }).reasons[0]!.en).toContain("Demo Bank Ltd.");
  });

  it("G1 active baina → AMBER", () => {
    const f = { ...clean(), bainas: [{ id: "B-0021", area_dec: 10, buyer_bn: "সালমা", expires_on: "2027-02-12" }] }; // prettier-ignore
    expect(verdict(f)).toBe("amber");
    expect(codes(f)).toEqual(["BAINA"]);
  });

  it("G1 after step 2: a blocked oversell attempt → RED 'requested area exceeds sellable balance'", () => {
    const f = {
      ...clean(),
      blocked_attempts: [{ area_dec: 15, reason_bn: "…", reason_en: "…", on: "2026-11-14" }],
    };
    expect(verdict(f)).toBe("red");
    expect(evaluate(f, { today }).reasons[0]!.en).toContain(
      "Requested area exceeds sellable balance",
    );
  });

  it("checking a specific request larger than the sellable share → RED", () => {
    const f = clean();
    f.holders[0]!.sellable_dec = 10;
    expect(verdict(f, { seller_id: 1, area_dec: 15 })).toBe("red");
    expect(codes(f, { seller_id: 1, area_dec: 15 })).toContain("EXCEEDS_SELLABLE");
    expect(verdict(f, { seller_id: 1, area_dec: 10 })).toBe("green");
    expect(codes(f, { seller_id: 99, area_dec: 1 })).toContain("SELLER_NOT_RECORDED");
  });

  it("deceased recorded owner → AMBER", () => {
    const f = clean();
    f.holders[0]!.is_deceased = true;
    expect(codes(f)).toContain("OWNER_DECEASED");
    expect(verdict(f)).toBe("amber");
  });

  it("registered deed without mutation → AMBER citing SAT Act s.143", () => {
    const f = {
      ...clean(),
      unmutated_deeds: [
        { deed_no: "4512/2024", registered_on: "2024-05-14", area_dec: 8, seller_bn: "রহিম", buyer_bn: "করিম", mutation_case: null, mutation_status: null }, // prettier-ignore
      ],
    };
    const r = evaluate(f, { today }).reasons;
    expect(r[0]!.code).toBe("MUTATION_PENDING");
    expect(r[0]!.basis).toContain("s.143");
  });

  it("tax arrears → AMBER; last year's payment is still fine", () => {
    const old = { ...clean(), tax: [{ owner_id: 1, name_bn: "রহিম", paid_through_fy: "2021-22" }] };
    expect(codes(old)).toContain("TAX_ARREARS");
    const lastYear = {
      ...clean(),
      tax: [{ owner_id: 1, name_bn: "রহিম", paid_through_fy: "2025-26" }],
    };
    expect(verdict(lastYear)).toBe("green");
  });

  it("G3 khatian 3 dec larger than the map → AMBER 'verify boundary with an amin'", () => {
    const f = clean();
    f.dag.recorded_area_dec = 22.1;
    f.map_area_dec = 19.06;
    f.chain = f.chain.map((c) => ({ ...c, area_dec: 22.1 }));
    const r = evaluate(f, { today }).reasons;
    expect(r.map((x) => x.code)).toEqual(["MAP_MISMATCH"]);
    expect(r[0]!.en).toContain("Verify the boundary with an amin");
  });

  it("a small map difference is only an info note", () => {
    const f = clean();
    f.map_area_dec = 18.6;
    expect(verdict(f)).toBe("green");
    expect(codes(f)).toContain("MAP_SMALL_DIFF");
  });

  it("area disagreement between surveys → AMBER", () => {
    const f = clean();
    f.chain[2]!.area_dec = 22.5;
    expect(codes(f)).toContain("CHAIN_MISMATCH");
  });

  it("the most serious finding decides the verdict", () => {
    const f = {
      ...clean(),
      khas: { category_bn: "খাস", category_en: "Khas" },
      liens: [{ id: "L-1", area_dec: 1, lender_bn: "ব্যাংক", lender_en: "Bank", owner_id: 1 }],
    };
    expect(verdict(f)).toBe("red");
    expect(codes(f)[0]).toBe("KHAS");
  });
});

describe("helpers", () => {
  it("Bangla digits", () => {
    expect(bn("145")).toBe("১৪৫");
    expect(bn(20.5)).toBe("২০.৫");
  });

  it("Bangladesh fiscal year starts in July", () => {
    expect(fiscalYearStart(new Date("2026-06-30T00:00:00Z"))).toBe(2025);
    expect(fiscalYearStart(new Date("2026-07-01T00:00:00Z"))).toBe(2026);
  });
});

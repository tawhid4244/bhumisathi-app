import { round } from "./area";
import type { DagFacts } from "./records";

// Jomi Check rules engine: facts about a dag → red / amber / green verdict with reasons.
// Pure functions only (no database, no clock unless passed in), so every rule is unit-tested.
// The verdict is a risk check on records, never a ruling on who owns the land.

export type Severity = "red" | "amber" | "info";
export type Verdict = "red" | "amber" | "green";

export interface Reason {
  code: string;
  severity: Severity;
  bn: string;
  en: string;
  /** Legal or official basis shown to the citizen, when there is one. */
  basis?: string;
}

/** Optional context when a specific transaction is being checked (registry screen, agent). */
export interface CheckContext {
  seller_id?: number;
  area_dec?: number;
  today?: Date;
}

/** Bangla digits for display. */
export function bn(n: number | string): string {
  return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
}

/** Bangladesh fiscal year (July–June) of a date, e.g. 2026-11-14 → 2026 (FY 2026-27). */
export function fiscalYearStart(d: Date): number {
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

// Thresholds, kept here so they are easy to explain and change.
export const MAP_MISMATCH_DEC = 2; // khatian vs map difference that needs an amin
export const MAP_MISMATCH_PCT = 0.1;
export const CHAIN_MISMATCH_DEC = 1; // area difference between surveys worth flagging
export const MUTATION_LIMIT_DAYS = 28; // e-mutation service limit

type Rule = (f: DagFacts, ctx: CheckContext) => Reason[];

const khas: Rule = (f) =>
  f.khas
    ? [
        {
          code: "KHAS",
          severity: "red",
          bn: `খাস জমি (${f.khas.category_bn}): সরকারি জমি, ব্যক্তিগতভাবে কেনা-বেচা করা যায় না।`,
          en: `Khas land (${f.khas.category_en}): government land, cannot be bought or sold privately.`,
        },
      ]
    : [];

const pendingCase: Rule = (f) =>
  f.cases
    .filter((c) => c.status === "pending")
    .map((c) => ({
      code: "COURT_CASE",
      severity: "red" as const,
      bn: `মামলা চলমান: ${c.court_bn}, মামলা নং ${bn(c.case_no)} (${c.summary_bn})।`,
      en: `Court case pending: ${c.court_en}, case ${c.case_no} (${c.summary_en}).`,
      basis: "Transfer of Property Act 1882, s.52 (lis pendens)",
    }));

const requestedArea: Rule = (f, ctx) => {
  if (ctx.seller_id == null || ctx.area_dec == null) return [];
  const h = f.holders.find((x) => x.owner_id === ctx.seller_id);
  if (!h) {
    return [
      {
        code: "SELLER_NOT_RECORDED",
        severity: "red",
        bn: "বিক্রেতার নাম এই দাগের সর্বশেষ (বিএস) খতিয়ানে নেই।",
        en: "The seller is not on the latest (BS) khatian for this dag.",
      },
    ];
  }
  if (ctx.area_dec > h.sellable_dec) {
    return [
      {
        code: "EXCEEDS_SELLABLE",
        severity: "red",
        bn: `অনুরোধ করা জমি (${bn(ctx.area_dec)} শতক) বিক্রয়যোগ্য পরিমাণের (${bn(h.sellable_dec)} শতক) চেয়ে বেশি।`,
        en: `Requested area exceeds sellable balance: ${ctx.area_dec} requested, ${h.sellable_dec} sellable.`,
      },
    ];
  }
  return [];
};

const blockedAttempts: Rule = (f) =>
  f.blocked_attempts.slice(0, 1).map((a) => ({
    code: "BLOCKED_ATTEMPT",
    severity: "red" as const,
    bn: `সতর্কতা: ${bn(a.on)} তারিখে বিক্রয়যোগ্য পরিমাণের চেয়ে বেশি জমি (${bn(a.area_dec)} শতক) বিক্রির চেষ্টা আটকানো হয়েছে। ${a.reason_bn}`,
    en: `Warning: on ${a.on} an attempt to sell more than the sellable balance (${a.area_dec} dec) was blocked. Requested area exceeds sellable balance. ${a.reason_en}`,
  }));

const deceasedOwner: Rule = (f) =>
  f.holders
    .filter((h) => h.is_deceased)
    .map((h) => ({
      code: "OWNER_DECEASED",
      severity: "amber" as const,
      bn: `রেকর্ডীয় মালিক ${h.name_bn} মৃত। ওয়ারিশ সনদ, বণ্টননামা ও নামজারি ছাড়া এই জমি কেনা ঝুঁকিপূর্ণ।`,
      en: `Recorded owner ${h.name_en} has died. Buying before succession, partition and mutation is risky.`,
    }));

const liens: Rule = (f) =>
  f.liens.map((l) => ({
    code: "MORTGAGE",
    severity: "amber" as const,
    bn: `${bn(l.area_dec)} শতক জমি ${l.lender_bn}-এর কাছে বন্ধক (${l.id})। ব্যাংকের ছাড়পত্র ছাড়া ওই অংশ বিক্রি করা যাবে না।`,
    en: `${l.area_dec} decimals mortgaged to ${l.lender_en} (${l.id}). That portion cannot be sold without the bank's release.`,
  }));

const bainas: Rule = (f) =>
  f.bainas.map((b) => ({
    code: "BAINA",
    severity: "amber" as const,
    bn: `${bn(b.area_dec)} শতক জমি বায়না ${b.id} দ্বারা ${bn(b.expires_on)} পর্যন্ত সংরক্ষিত (ক্রেতা: ${b.buyer_bn})।`,
    en: `${b.area_dec} decimals reserved by baina ${b.id} until ${b.expires_on}.`,
  }));

const unmutatedDeeds: Rule = (f) =>
  f.unmutated_deeds.map((d) => ({
    code: "MUTATION_PENDING",
    severity: "amber" as const,
    bn: d.mutation_case
      ? `দলিল ${bn(d.deed_no)} (${bn(d.area_dec)} শতক, ${d.seller_bn} → ${d.buyer_bn}) নিবন্ধিত; নামজারি মামলা ${d.mutation_case} এখনও চলমান।`
      : `দলিল ${bn(d.deed_no)} (${bn(d.area_dec)} শতক, ${d.seller_bn} → ${d.buyer_bn}) নিবন্ধিত হলেও নামজারি হয়নি। খতিয়ান এখনও পুরনো মালিকের নামে।`,
    en: d.mutation_case
      ? `Deed ${d.deed_no} (${d.area_dec} dec) registered; mutation case ${d.mutation_case} still pending.`
      : `Deed ${d.deed_no} (${d.area_dec} dec) was registered but never mutated; the khatian still shows the old owner.`,
    basis: "State Acquisition and Tenancy Act 1950, s.143 (mutation)",
  }));

const taxArrears: Rule = (f, ctx) => {
  const fy = fiscalYearStart(ctx.today ?? new Date());
  return f.tax
    .filter((t) => Number(t.paid_through_fy.slice(0, 4)) < fy - 1)
    .map((t) => ({
      code: "TAX_ARREARS",
      severity: "amber" as const,
      bn: `ভূমি উন্নয়ন কর বকেয়া: ${t.name_bn} সর্বশেষ ${bn(t.paid_through_fy)} অর্থবছর পর্যন্ত পরিশোধ করেছেন। হালনাগাদ দাখিলা ছাড়া রেজিস্ট্রি করা যায় না।`,
      en: `Land development tax arrears: ${t.paid_through_fy} is the last fiscal year paid. Registration needs a current tax receipt (dakhila).`,
      basis: "Land Development Tax Act 2023",
    }));
};

const mapMismatch: Rule = (f) => {
  if (f.map_area_dec == null) return [];
  const diff = round(f.dag.recorded_area_dec - f.map_area_dec, 2);
  const abs = Math.abs(diff);
  const more = diff > 0;
  if (abs >= MAP_MISMATCH_DEC || abs / f.map_area_dec >= MAP_MISMATCH_PCT) {
    return [
      {
        code: "MAP_MISMATCH",
        severity: "amber",
        bn: `খতিয়ানে দাগের আয়তন (${bn(f.dag.recorded_area_dec)} শতক) মৌজা ম্যাপের মাপের (${bn(f.map_area_dec)} শতক) চেয়ে ${bn(abs)} শতক ${more ? "বেশি" : "কম"}। আমিন দিয়ে সীমানা যাচাই করুন।`,
        en: `The khatian records ${abs} decimals ${more ? "more" : "less"} than the mouza map (${f.dag.recorded_area_dec} vs ${f.map_area_dec}). Verify the boundary with an amin.`,
      },
    ];
  }
  if (abs >= 1) {
    return [
      {
        code: "MAP_SMALL_DIFF",
        severity: "info",
        bn: `খতিয়ান ও ম্যাপের মাপে সামান্য পার্থক্য (${bn(abs)} শতক), সাধারণত সহনীয়।`,
        en: `Small difference between khatian and map (${abs} decimals), usually within tolerance.`,
      },
    ];
  }
  return [];
};

const chainMismatch: Rule = (f) => {
  const bs = f.chain.find((c) => c.survey === "BS");
  if (!bs) {
    return [
      {
        code: "NO_BS",
        severity: "amber",
        bn: "সর্বশেষ (বিএস) খতিয়ান পাওয়া যায়নি; রেকর্ড অসম্পূর্ণ।",
        en: "No latest (BS) khatian found; the record chain is incomplete.",
      },
    ];
  }
  return f.chain
    .filter((c) => c.survey !== "BS" && Math.abs(c.area_dec - bs.area_dec) > CHAIN_MISMATCH_DEC)
    .map((c) => ({
      code: "CHAIN_MISMATCH",
      severity: "amber" as const,
      bn: `${c.survey} খতিয়ানে আয়তন ${bn(c.area_dec)} শতক, কিন্তু বিএস খতিয়ানে ${bn(bs.area_dec)} শতক। পার্থক্যের কারণ (বিভাজন বা ভুল) যাচাই করুন।`,
      en: `${c.survey} khatian records ${c.area_dec} decimals but BS records ${bs.area_dec}. Check why (split or error).`,
    }));
};

/** Rules in the order they are shown: most serious first. */
export const RULES: Rule[] = [
  khas,
  pendingCase,
  requestedArea,
  blockedAttempts,
  deceasedOwner,
  liens,
  bainas,
  unmutatedDeeds,
  taxArrears,
  mapMismatch,
  chainMismatch,
];

export function evaluate(
  facts: DagFacts,
  ctx: CheckContext = {},
): { verdict: Verdict; reasons: Reason[] } {
  const reasons = RULES.flatMap((rule) => rule(facts, ctx));
  const verdict: Verdict = reasons.some((r) => r.severity === "red")
    ? "red"
    : reasons.some((r) => r.severity === "amber")
      ? "amber"
      : "green";
  if (verdict === "green") {
    reasons.unshift({
      code: "CLEAR",
      severity: "info",
      bn: "রেকর্ডে কোনো ঝুঁকি পাওয়া যায়নি: খতিয়ান, কর, মামলা, বন্ধক ও বায়না পরিষ্কার।",
      en: "No risk found in the records: khatian, tax, cases, mortgages and bainas are clear.",
    });
  }
  return { verdict, reasons };
}

export const VERDICT_LABEL: Record<Verdict, { bn: string; en: string; advice_bn: string }> = {
  red: { bn: "লাল: ঝুঁকিপূর্ণ", en: "Red: high risk", advice_bn: "এই অবস্থায় টাকা দেবেন না।" },
  amber: {
    bn: "হলুদ: সতর্কতা",
    en: "Amber: check first",
    advice_bn: "কেনার আগে নিচের বিষয়গুলো যাচাই করুন।",
  },
  green: {
    bn: "সবুজ: রেকর্ডে ঝুঁকি নেই",
    en: "Green: no risk in records",
    advice_bn: "তবুও দলিল লেখার আগে মূল কাগজ দেখে নিন।",
  },
};

export const DISCLAIMER = {
  bn: "এটি সরকারি রেকর্ডের ঝুঁকি যাচাই (কাল্পনিক তথ্যে), মালিকানার আইনি রায় নয়। খতিয়ান বা নামজারি নিজে মালিকানার প্রমাণ নয়।",
  en: "This is a risk check on records (synthetic data), not a legal ruling on ownership. A khatian or mutation is not itself proof of title.",
};

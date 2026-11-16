import { bn } from "../engines/rules";

// Fixed bilingual answers for the fast path (lib/ai/agent.ts → tryFastPath). Every number comes
// from the tool output; nothing is invented. Kept short so it reads well aloud.

export interface FastAnswer {
  text: string;
}

interface CheckOut {
  verdict: "red" | "amber" | "green";
  verdict_bn: string;
  verdict_en: string;
  advice_bn: string;
  advice_en: string;
  dag: { mouza_bn: string; mouza_en: string; dag_no: number; recorded_area_dec: number };
  reasons: { severity: "red" | "amber" | "info"; bn: string; en: string }[];
  holders: { sellable_dec: number }[];
}

interface AreaOut {
  mouza_bn: string;
  mouza_en: string;
  dag_no: number;
  map_area_dec: number;
  recorded_area_dec: number;
  matches_khatian: boolean;
  is_khas: boolean;
  units: { katha: number; bigha: number; acre: number; sqft: number };
}

interface UnitsOut {
  uses_kani: boolean;
  variants: {
    label_bn: string;
    label_en: string;
    units: { decimals: number; acre: number; katha: number; bigha: number; sqft: number };
  }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: number, english: boolean) => (english ? String(r2(n)) : bn(r2(n)));

type Input =
  | { kind: "check"; output: unknown; english: boolean }
  | { kind: "area"; output: unknown; english: boolean }
  | { kind: "units"; output: unknown; english: boolean }
  | {
      kind: "which_mouza";
      dag_no: number;
      matches: { mouza_bn: string; mouza_en: string }[];
      english: boolean;
    };

export function fastReply(input: Input): FastAnswer {
  const en = input.english;
  switch (input.kind) {
    case "which_mouza": {
      if (input.matches.length === 0) {
        return {
          text: en
            ? `I could not find dag ${input.dag_no} in any mouza. Please check the number and say it again.`
            : `দাগ ${bn(input.dag_no)} কোনো মৌজায় পাওয়া যায়নি। নম্বরটি দেখে আবার বলুন।`,
        };
      }
      const names = input.matches.map((m) => (en ? m.mouza_en : m.mouza_bn)).join(en ? ", " : ", ");
      return {
        text: en
          ? `Dag ${input.dag_no} exists in more than one mouza: ${names}. Which mouza is it?`
          : `দাগ ${bn(input.dag_no)} একাধিক মৌজায় আছে: ${names}। কোন মৌজার দাগ?`,
      };
    }
    case "check": {
      const r = input.output as CheckOut;
      const top = [...r.reasons]
        .sort((a, b) => rank(a.severity) - rank(b.severity))
        .slice(0, 3)
        .map((x) => `- ${en ? x.en : x.bn}`);
      const sellable = r2(r.holders.reduce((s, h) => s + h.sellable_dec, 0));
      const lines = en
        ? [
            `Result: ${r.verdict_en} (${r.dag.mouza_en}, dag ${r.dag.dag_no}). ${r.advice_en}`,
            ...top,
            `Sellable now: ${sellable} of ${r2(r.dag.recorded_area_dec)} decimals.`,
            "This is a risk check on records, not a legal ruling.",
          ]
        : [
            `ফলাফল: ${r.verdict_bn} (${r.dag.mouza_bn} দাগ ${bn(r.dag.dag_no)})। ${r.advice_bn}`,
            ...top,
            `এখন বিক্রয়যোগ্য: ${bn(r.dag.recorded_area_dec)} শতকের মধ্যে ${bn(sellable)} শতক।`,
            "এটি রেকর্ডের ঝুঁকি যাচাই, আইনি রায় নয়।",
          ];
      return { text: lines.join("\n") };
    }
    case "area": {
      const a = input.output as AreaOut;
      const khas = a.is_khas
        ? en
          ? " Note: this dag is recorded as khas (government) land."
          : " সতর্কতা: এই দাগ খাস (সরকারি) জমি হিসেবে চিহ্নিত।"
        : "";
      return {
        text: en
          ? `Dag ${a.dag_no} (${a.mouza_en}) measures about ${r2(a.map_area_dec)} decimals on the mouza map (≈ ${r2(a.units.katha)} katha, ${r2(a.units.bigha)} bigha); the khatian says ${r2(a.recorded_area_dec)} decimals — ${a.matches_khatian ? "they match" : "they differ, have an amin check it"}.${khas} This is an estimate, not a survey.`
          : `দাগ ${bn(a.dag_no)}-এর মাপ মৌজা ম্যাপ অনুযায়ী প্রায় ${bn(r2(a.map_area_dec))} শতক (≈ ${bn(r2(a.units.katha))} কাঠা, ${bn(r2(a.units.bigha))} বিঘা); খতিয়ানে ${bn(r2(a.recorded_area_dec))} শতক — ${a.matches_khatian ? "মিলেছে" : "অমিল, আমিন দিয়ে যাচাই করুন"}।${khas} এটি আনুমানিক মাপ, জরিপ নয়।`,
      };
    }
    case "units": {
      const u = input.output as UnitsOut;
      if (u.uses_kani && u.variants.length > 1) {
        const rows = u.variants.map(
          (v) => `- ${en ? v.label_en : v.label_bn}: ${num(v.units.decimals, en)} ${en ? "decimals" : "শতক"}`, // prettier-ignore
        );
        const head = en
          ? "The size of a kani differs by area, so here is each common size:"
          : "কানির মাপ এলাকাভেদে ভিন্ন, তাই প্রতিটি প্রচলিত মাপে:";
        return { text: [head, ...rows].join("\n") };
      }
      const v = u.variants[0]!.units;
      return {
        text: en
          ? `That is ${num(v.decimals, en)} decimals = ${num(v.katha, en)} katha = ${num(v.bigha, en)} bigha = ${num(v.acre, en)} acres (${num(v.sqft, en)} sq ft).`
          : `এটি ${num(v.decimals, en)} শতক = ${num(v.katha, en)} কাঠা = ${num(v.bigha, en)} বিঘা = ${num(v.acre, en)} একর (${num(v.sqft, en)} বর্গফুট)।`,
      };
    }
  }
}

function rank(s: "red" | "amber" | "info"): number {
  return s === "red" ? 0 : s === "amber" ? 1 : 2;
}

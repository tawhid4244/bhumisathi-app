import type { UnitId } from "../engines/units";
import { normalizeTranscript } from "./bn-numbers";

// Fast intent detection for the commonest questions, so they can be answered in under a second
// without a model call: "১৪৫ নম্বর দাগ কেনা নিরাপদ?", "দাগ ১৪৫-এর মাপ কত?", "২ কানি ৫ গন্ডা কত শতক?".
// Anything else (laws, fees, writes, inheritance, follow-ups, "why" questions) returns null and
// goes to the model as before. Pure functions; unit-tested in tests/unit/intent.test.ts.

export interface MouzaName {
  name_bn: string;
  name_en: string;
}

export type Intent =
  | { kind: "check"; dag_no: number; mouza: string | null }
  | { kind: "area"; dag_no: number; mouza: string | null }
  | { kind: "units"; amounts: { value: number; unit: UnitId }[] };

const BN = "\\u0980-\\u09FF";
/** A Bangla/English word that is not part of a longer Bangla word (so "কেন" ≠ "কেনা"). */
const word = (alts: string) =>
  new RegExp(`(?<![${BN}a-z])(?:${alts.normalize("NFC")})(?![${BN}])`, "i");

/** Questions the fast path must leave to the model. */
const LEAVE_TO_MODEL = [
  word("বায়না|বিক্রি কর|বিক্রয় কর|নিবন্ধন|রেজিস্ট্রি|বন্ধক|register|record|mortgage|baina"),
  word("ওয়ারিশ|ওয়ারিশ|উত্তরাধিকার|ফারায়েজ|ফারায়েজ|বণ্টন|বন্টন|warish|inherit\\w*|heirs?"),
  word("ফি|খরচ|টাকা লাগে|fee|fees|cost"),
  word("আইন|ধারা|law|section|act"),
  word("কেন|কিভাবে|কীভাবে|কি ভাবে|why|how to|how do"),
  word("দলিল|deed|খতিয়ান|khatian|নামজারি|mutation|খাজনা|ভূমি উন্নয়ন কর|tax"),
  word("মালিক কে|who owns|owner"),
];

const CHECK_WORDS = word(
  "নিরাপদ|যাচাই|চেক|কেনা|কিনব|কিনতে|ঝুঁকি|অবস্থা|রিপোর্ট|দেখাও|দেখান|মামলা|safe|check|buy|risk|report|status",
);
const AREA_WORDS = word("মাপ|আয়তন|আয়তন|কত বড়|কত বড়|কত শতক|area|size|measure|how big");
const CONVERT_WORDS = word("কত|সমান|রূপান্তর|হয়|হয়|convert|how many|how much|equals?|in decimals");

const UNIT_WORDS: [RegExp, UnitId][] = [
  [/^(কানি|kani)$/i, "kani"],
  [/^(গন্ডা|গণ্ডা|gonda|ganda)$/i, "gonda"],
  [/^(কড়া|কড়া|kora)$/i, "kora"],
  [/^(ক্রান্তি|kranti)$/i, "kranti"],
  [/^(কাঠা|katha|kathas)$/i, "katha"],
  [/^(বিঘা|bigha|bighas)$/i, "bigha"],
  [/^(একর|acre|acres)$/i, "acre"],
  [/^(শতক|শতাংশ|ডেসিমাল|decimal|decimals|dec)$/i, "decimal"],
  [/^(বর্গফুট|sqft|sq\.? ?ft|square feet)$/i, "sqft"],
];

function unitOf(w: string): UnitId | null {
  const n = w.normalize("NFC");
  for (const [re, id] of UNIT_WORDS) if (re.test(n) || re.test(w)) return id;
  return null;
}

/** "145 নম্বর দাগ", "দাগ নং 145", "দাগ 145-এর", "dag 145", "plot no. 145". */
export function findDagNumber(text: string): number | null {
  const patterns = [
    /(\d{1,5})\s*(?:নম্বর|নম্বরের|নং|নাম্বার|no\.?)?\s*দাগ/,
    /দাগ\s*(?:নম্বর|নং|নাম্বার|no\.?|#)?\s*[:-]?\s*(\d{1,5})/,
    /\b(?:dag|plot)\s*(?:no\.?|number|#)?\s*(\d{1,5})\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const n = Number(m[1]);
      if (n > 0) return n;
    }
  }
  return null;
}

/** Edit distance (small strings only). */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1)); // prettier-ignore
    }
    prev = cur;
  }
  return prev[y.length]!;
}

/** Strip common Bangla case endings: নয়াপাড়ার → নয়াপাড়া, নয়াপাড়ায় → নয়াপাড়া. */
function stem(w: string): string {
  return w.replace(/(এর|ের|র|য়|য়|তে|ে)$/u, "");
}

/**
 * Which mouza the text names, if any. Exact names first, then a close spelling (speech engines
 * often write "নয়াপারা" for "নয়াপাড়া"): one or two letters off, never for short words.
 */
export function findMouza<M extends MouzaName>(text: string, mouzas: M[]): M | null {
  const t = text.normalize("NFC").toLowerCase();
  for (const m of mouzas) {
    if (t.includes(m.name_bn.normalize("NFC")) || t.includes(m.name_en.toLowerCase())) return m;
  }
  const words = t.split(/[\s,।?!.;:\-–]+/).filter((w) => w.length >= 4);
  let best: { m: M; d: number } | null = null;
  for (const m of mouzas) {
    const names = [m.name_bn.normalize("NFC"), m.name_en.toLowerCase()];
    for (const w of words) {
      for (const name of names) {
        const len = [...name].length;
        const allowed = len >= 7 ? 2 : len >= 5 ? 1 : 0;
        const d = Math.min(editDistance(w, name), editDistance(stem(w), name));
        if (d <= allowed && (!best || d < best.d)) best = { m, d };
      }
    }
  }
  return best?.m ?? null;
}

/** Amounts like "2 কানি 5 গন্ডা" or "10.5 decimals". */
export function findAmounts(text: string): { value: number; unit: UnitId }[] {
  const out: { value: number; unit: UnitId }[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(sq\.? ?ft|square feet|[^\s\d,।?!.;:]+)/gi;
  for (const m of text.matchAll(re)) {
    const unit = unitOf(m[2]!);
    if (unit) out.push({ value: Number(m[1]), unit });
  }
  return out;
}

/**
 * Detect a fast intent in one user message. `mouzas` is the list of known mouzas, used to spot
 * a mouza name (exact or a close spelling).
 */
export function detectIntent(raw: string, mouzas: MouzaName[]): Intent | null {
  const text = normalizeTranscript(raw);
  if (text.length === 0 || text.length > 200) return null;
  if (LEAVE_TO_MODEL.some((re) => re.test(text))) return null;

  const dag = findDagNumber(text);
  if (dag != null) {
    const mouza = findMouza(text, mouzas);
    const name = mouza ? mouza.name_en : null;
    if (AREA_WORDS.test(text)) return { kind: "area", dag_no: dag, mouza: name };
    const short = text.split(" ").length <= 5; // "১৪৫ নম্বর দাগ" alone = check it
    if (CHECK_WORDS.test(text) || short) return { kind: "check", dag_no: dag, mouza: name };
    return null;
  }

  const amounts = findAmounts(text);
  if (amounts.length > 0 && amounts.length <= 6 && CONVERT_WORDS.test(text)) {
    return { kind: "units", amounts };
  }
  return null;
}

import table from "../../content/units.json";
import { round, SQFT_PER_DECIMAL } from "./area";

// Land units. The decimal (শতক) is the base: 1 decimal = 1/100 acre = 435.6 sq ft.
// Katha is commonly 720 sq ft. Bigha and kani differ by region, so they always come with the
// size used, and task 14 adds the district table and the converter page.

export const SQFT_PER_ACRE = 43_560;
export const SQM_PER_SQFT = 0.09290304;
export const SQFT_PER_KATHA = 720;
/** Standard bigha = 20 katha = 14,400 sq ft ≈ 33.06 decimals (varies by district). */
export const STANDARD_BIGHA_DEC = (20 * SQFT_PER_KATHA) / SQFT_PER_DECIMAL;

export interface AreaUnits {
  decimals: number;
  sqft: number;
  sqm: number;
  acre: number;
  katha: number;
  bigha: number;
  /** The bigha size used for the bigha figure, in decimals. */
  bigha_dec: number;
}

export function fromDecimals(dec: number, bighaDec = STANDARD_BIGHA_DEC): AreaUnits {
  const sqft = dec * SQFT_PER_DECIMAL;
  return {
    decimals: round(dec, 2),
    sqft: round(sqft, 0),
    sqm: round(sqft * SQM_PER_SQFT, 1),
    acre: round(dec / 100, 4),
    katha: round(sqft / SQFT_PER_KATHA, 2),
    bigha: round(dec / bighaDec, 3),
    bigha_dec: round(bighaDec, 2),
  };
}

export const decimalsFromSqft = (sqft: number) => sqft / SQFT_PER_DECIMAL;

const toBn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

// ---------- converter (task 14): data from content/units.json ----------

export type FixedUnit = "decimal" | "acre" | "sqft" | "sqm" | "hectare" | "katha";
export type UnitId = FixedUnit | "bigha" | "kani" | "gonda" | "kora" | "kranti";
export const UNIT_IDS: UnitId[] = ["decimal", "acre", "sqft", "sqm", "hectare", "katha", "bigha", "kani", "gonda", "kora", "kranti"]; // prettier-ignore
const KANI_FAMILY = new Set<UnitId>(["kani", "gonda", "kora", "kranti"]);

export const UNIT_BN: Record<UnitId, string> = {
  decimal: "শতক",
  acre: "একর",
  sqft: "বর্গফুট",
  sqm: "বর্গমিটার",
  hectare: "হেক্টর",
  katha: "কাঠা",
  bigha: "বিঘা",
  kani: "কানি",
  gonda: "গন্ডা",
  kora: "কড়া",
  kranti: "ক্রান্তি",
};

export const UNIT_EN: Record<UnitId, string> = {
  decimal: "decimal",
  acre: "acre",
  sqft: "square feet",
  sqm: "square metres",
  hectare: "hectare",
  katha: "katha",
  bigha: "bigha",
  kani: "kani",
  gonda: "gonda",
  kora: "kora",
  kranti: "kranti",
};

export interface Amount {
  value: number;
  unit: UnitId;
}

const rel = table.kani_family.relations;
/** How many kani one unit of the kani family is (1 kani = 20 gonda = 80 kora = 240 kranti). */
const KANI_PARTS: Record<string, number> = {
  kani: 1,
  gonda: 1 / rel.gonda_per_kani,
  kora: 1 / (rel.gonda_per_kani * rel.kora_per_gonda),
  kranti: 1 / (rel.gonda_per_kani * rel.kora_per_gonda * rel.kranti_per_kora),
};

export function toDecimals(amounts: Amount[], kaniDec: number, bighaDec: number): number {
  return amounts.reduce((sum, a) => {
    if (a.unit === "bigha") return sum + a.value * bighaDec;
    if (KANI_FAMILY.has(a.unit)) return sum + a.value * KANI_PARTS[a.unit]! * kaniDec;
    return sum + a.value * table.fixed[a.unit as FixedUnit].decimals;
  }, 0);
}

export interface ConversionVariant {
  kani_dec: number | null;
  label_bn: string;
  label_en: string;
  where_bn: string;
  where_en: string;
  source: string;
  units: AreaUnits & { kani: number | null };
}

export interface Conversion {
  uses_kani: boolean;
  variants: ConversionVariant[];
  rules_bn: string[];
  rules_en: string[];
}

/**
 * Convert one or more amounts ("২ কানি ৫ গন্ডা"). If kani-family units are used and no local
 * kani size is given, the result is shown for every size in the table, side by side.
 */
export function convertUnits(
  amounts: Amount[],
  opts: { kaniDec?: number; bighaDec?: number } = {},
): Conversion {
  if (amounts.length === 0) throw new Error("Give at least one amount");
  for (const a of amounts) {
    if (!(a.value >= 0) || !UNIT_IDS.includes(a.unit)) throw new Error("Invalid amount");
  }
  const bighaDec = opts.bighaDec ?? table.bigha.standard_dec;
  const usesKani = amounts.some((a) => KANI_FAMILY.has(a.unit));
  const sizes = !usesKani
    ? [null]
    : opts.kaniDec
      ? [opts.kaniDec]
      : table.kani_family.sizes.map((s) => s.kani_dec);
  const variants = sizes.map((k): ConversionVariant => {
    const dec = toDecimals(amounts, k ?? 0, bighaDec);
    const known = table.kani_family.sizes.find((s) => s.kani_dec === k);
    return {
      kani_dec: k,
      label_bn: k == null ? "রূপান্তর" : (known?.bn ?? `${toBn(k ?? 0)} শতকের কানি (আপনার দেওয়া)`),
      label_en: k == null ? "Conversion" : (known?.en ?? `Kani of ${k} decimals (your size)`),
      where_bn: k == null ? "" : (known?.where_bn ?? "আপনার এলাকার মাপ"),
      where_en: k == null ? "" : (known?.where_en ?? "The size in your area"),
      source: k == null ? "" : (known?.source ?? "Size given by the user"),
      units: { ...fromDecimals(dec, bighaDec), kani: k ? round(dec / k, 4) : null },
    };
  });
  const rules = [
    "১ শতক = ৪৩৫.৬ বর্গফুট; ১০০ শতক = ১ একর; ১ কাঠা = ৭২০ বর্গফুট।",
    `বিঘা ধরা হয়েছে ${toBn(round(bighaDec, 2))} শতক${opts.bighaDec ? " (আপনার দেওয়া)" : " (প্রমিত ২০ কাঠা)"}; এলাকাভেদে ভিন্ন হতে পারে।`,
  ];
  const rulesEn = [
    "1 decimal = 435.6 sq ft; 100 decimals = 1 acre; 1 katha = 720 sq ft.",
    `A bigha is taken as ${round(bighaDec, 2)} decimals${opts.bighaDec ? " (your size)" : " (standard 20 katha)"}; it differs by region.`,
  ];
  if (usesKani) {
    rulesEn.push("1 kani = 20 gonda, 1 gonda = 4 kora, 1 kora = 3 kranti.");
    rulesEn.push(opts.kaniDec ? `A kani is taken as ${opts.kaniDec} decimals (your size).` : "The kani differs by region, so the result is shown for every common size — pick the one for the area your deed is from."); // prettier-ignore
    rules.push("১ কানি = ২০ গন্ডা, ১ গন্ডা = ৪ কড়া, ১ কড়া = ৩ ক্রান্তি।");
    rules.push(opts.kaniDec ? `কানি ধরা হয়েছে ${toBn(opts.kaniDec)} শতক (আপনার দেওয়া)।` : "কানির মাপ এলাকাভেদে ভিন্ন, তাই প্রতিটি প্রচলিত মাপে ফল দেখানো হলো — আপনার দলিল কোন এলাকার তা দেখে বেছে নিন।"); // prettier-ignore
  }
  return { uses_kani: usesKani, variants, rules_bn: rules, rules_en: rulesEn };
}

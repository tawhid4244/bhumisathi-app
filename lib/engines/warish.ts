import { Fraction, frac } from "./fraction";

// Warish (inheritance) shares under Hanafi Muslim law as applied in Bangladesh, with
// Muslim Family Laws Ordinance 1961 s.4 (children of a son or daughter who died before the
// deceased take that child's share). Exact fractions only. This is a calculation aid: a court,
// a warish certificate and a registered bontonnama make a partition binding.
//
// Supported heirs: husband, up to four wives, father, mother, sons, daughters, predeceased sons
// and daughters (through their living children), full brothers and full sisters. Anything else
// (grandparents, half-siblings, uncles…) is reported as "not supported" instead of guessing.

export interface PredeceasedChild {
  sons: number;
  daughters: number;
}

export interface Family {
  husband?: boolean;
  wives?: number;
  father?: boolean;
  mother?: boolean;
  sons?: number;
  daughters?: number;
  predeceasedSons?: PredeceasedChild[];
  predeceasedDaughters?: PredeceasedChild[];
  fullBrothers?: number;
  fullSisters?: number;
}

export type Relation =
  | "husband"
  | "wife"
  | "father"
  | "mother"
  | "son"
  | "daughter"
  | "grandson"
  | "granddaughter"
  | "brother"
  | "sister";

export interface HeirShare {
  key: string; // stable id, e.g. "son-1", "pson-1-daughter-2"
  relation: Relation;
  label_bn: string;
  label_en: string;
  share: Fraction;
  /** Why this heir gets this share, in plain Bangla (and English). */
  basis_bn: string;
  basis_en: string;
}

export interface WarishResult {
  shares: HeirShare[];
  flags: { awl: boolean; radd: boolean; umariyyatayn: boolean; mflo: boolean; spouseRadd: boolean };
  steps_bn: string[];
  steps_en: string[];
}

/** English for every "basis" phrase used below (same meaning, for the English screen). */
const BASIS_EN: Record<string, string> = {
  "নির্ধারিত অংশ (ফারায়েজ)": "Fixed share (faraid)",
  "নির্ধারিত অংশ, স্ত্রীরা সমান ভাগে": "Fixed share, wives share equally",
  "নির্ধারিত অংশ": "Fixed share",
  "অবশিষ্টাংশভোগী ('আসাবা)": "Residuary heir ('asaba)",
  "নির্ধারিত অংশ + অবশিষ্টাংশ": "Fixed share + residue",
  "অবশিষ্টাংশ, মেয়ের দ্বিগুণ": "Residue, twice a daughter's share",
  "অবশিষ্টাংশ, ছেলের অর্ধেক": "Residue, half a son's share",
  "মুসলিম পারিবারিক আইন অধ্যাদেশ ১৯৬১, ধারা ৪": "Muslim Family Laws Ordinance 1961, s.4",
  অবশিষ্টাংশ: "Residue",
  "অবশিষ্টাংশ, ভাইয়ের অর্ধেক": "Residue, half a brother's share",
  "মেয়ের সঙ্গে অবশিষ্টাংশ": "Residue, together with daughters",
};

export class WarishInputError extends Error {}

const BN = "০১২৩৪৫৬৭৮৯";
export const bnNum = (s: string | number) => String(s).replace(/\d/g, (d) => BN[Number(d)]!);
const bnFrac = (f: Fraction) => bnNum(f.toString());

function validate(f: Family) {
  const counts: [string, number | undefined, number][] = [
    ["wives", f.wives, 4],
    ["sons", f.sons, 30],
    ["daughters", f.daughters, 30],
    ["fullBrothers", f.fullBrothers, 30],
    ["fullSisters", f.fullSisters, 30],
  ];
  for (const [name, v, max] of counts) {
    if (v !== undefined && (!Number.isInteger(v) || v < 0 || v > max)) {
      throw new WarishInputError(`${name} must be a whole number from 0 to ${max}`);
    }
  }
  if (f.husband && (f.wives ?? 0) > 0) {
    throw new WarishInputError("A deceased person cannot leave both a husband and a wife");
  }
}

/** Equal split of a group share among n people. */
const each = (share: Fraction, n: number) => share.div(frac(n));

/** Male:female 2:1 split of a share among m males and f females → [per male, per female]. */
function twoToOne(share: Fraction, m: number, f: number): [Fraction, Fraction] {
  const units = frac(2 * m + f);
  return [share.mul(frac(2)).div(units), share.div(units)];
}

export function computeWarish(input: Family): WarishResult {
  validate(input);
  const f: Required<Family> = {
    husband: false,
    wives: 0,
    father: false,
    mother: false,
    sons: 0,
    daughters: 0,
    predeceasedSons: [],
    predeceasedDaughters: [],
    fullBrothers: 0,
    fullSisters: 0,
    ...input,
  };
  // MFLO s.4: a predeceased child counts as alive IF they left living children.
  const pSons = f.predeceasedSons.filter((c) => c.sons + c.daughters > 0);
  const pDaughters = f.predeceasedDaughters.filter((c) => c.sons + c.daughters > 0);
  const sonSlots = f.sons + pSons.length;
  const daughterSlots = f.daughters + pDaughters.length;
  const hasChild = sonSlots + daughterSlots > 0;
  const hasSon = sonSlots > 0;
  const siblings = f.fullBrothers + f.fullSisters;
  // Full siblings are excluded by a son (or a predeceased son's line) and by the father.
  const siblingsInherit = !hasSon && !f.father && siblings > 0;
  const steps: string[] = [];
  const stepsEn: string[] = [];
  /** One explanation line, in Bangla and English. */
  const step = (bn: string, en: string) => {
    steps.push(bn);
    stepsEn.push(en);
  };
  const fr = (x: Fraction) => x.toString();

  // ---- 1. Fixed shares (fard) ----
  type Group = "spouse" | "father" | "mother" | "daughters" | "sisters";
  const fard = new Map<Group, Fraction>();
  let spouseShare = Fraction.ZERO;
  if (f.husband) {
    spouseShare = hasChild ? frac(1, 4) : frac(1, 2);
    step(`স্বামী: সন্তান ${hasChild ? "থাকায়" : "না থাকায়"} ${bnFrac(spouseShare)}।`, `Husband: ${fr(spouseShare)} because there ${hasChild ? "are" : "are no"} children.`); // prettier-ignore
  } else if (f.wives > 0) {
    spouseShare = hasChild ? frac(1, 8) : frac(1, 4);
    step(`স্ত্রী: সন্তান ${hasChild ? "থাকায়" : "না থাকায়"} ${bnFrac(spouseShare)}${f.wives > 1 ? `, ${bnNum(f.wives)} জন স্ত্রী সমান ভাগে` : ""}।`, `Wife: ${fr(spouseShare)} because there ${hasChild ? "are" : "are no"} children${f.wives > 1 ? `, shared equally by ${f.wives} wives` : ""}.`); // prettier-ignore
  }
  if (!spouseShare.isZero()) fard.set("spouse", spouseShare);

  // Umariyyatayn: spouse + father + mother only (no children, fewer than 2 siblings):
  // the mother gets 1/3 of what is left after the spouse, not 1/3 of the whole.
  const umariyyatayn = f.mother && f.father && !spouseShare.isZero() && !hasChild && siblings < 2;
  if (f.mother) {
    let m: Fraction;
    if (hasChild || siblings >= 2) {
      m = frac(1, 6);
      step(`মা: ${hasChild ? "সন্তান" : "দুই বা ততোধিক ভাইবোন"} থাকায় ১/৬।`, `Mother: 1/6 because there ${hasChild ? "are children" : "are two or more siblings"}.`); // prettier-ignore
    } else if (umariyyatayn) {
      m = Fraction.ONE.sub(spouseShare).mul(frac(1, 3));
      step(`মা: স্বামী/স্ত্রী ও বাবা আছেন (উমারিয়্যাতাইন) — বাকি অংশের ১/৩ = ${bnFrac(m)}।`, `Mother: spouse and father are alive (umariyyatayn) — 1/3 of the rest = ${fr(m)}.`); // prettier-ignore
    } else {
      m = frac(1, 3);
      step("মা: সন্তান বা দুই ভাইবোন না থাকায় ১/৩।", "Mother: 1/3 because there are no children and fewer than two siblings."); // prettier-ignore
    }
    fard.set("mother", m);
  }
  if (f.father && hasChild) {
    fard.set("father", frac(1, 6));
    if (hasSon) step("বাবা: ছেলে থাকায় ১/৬।", "Father: 1/6 because there is a son.");
    else step("বাবা: শুধু মেয়ে থাকায় ১/৬, এবং বাকি অংশ (যদি থাকে)।", "Father: 1/6 because there are only daughters, plus any residue."); // prettier-ignore
  }
  if (!hasSon && daughterSlots > 0) {
    const d = daughterSlots === 1 ? frac(1, 2) : frac(2, 3);
    fard.set("daughters", d);
    step(`মেয়ে: ছেলে না থাকায় ${daughterSlots === 1 ? "একজন মেয়ে ১/২" : `${bnNum(daughterSlots)} জন মেয়ে মিলে ২/৩`}।`, `Daughters: no son, so ${daughterSlots === 1 ? "one daughter takes 1/2" : `${daughterSlots} daughters together take 2/3`}.`); // prettier-ignore
  }
  const sistersFard = siblingsInherit && f.fullBrothers === 0 && daughterSlots === 0 && f.fullSisters > 0; // prettier-ignore
  if (sistersFard) {
    fard.set("sisters", f.fullSisters === 1 ? frac(1, 2) : frac(2, 3));
    step(`বোন: ${f.fullSisters === 1 ? "একজন বোন ১/২" : `${bnNum(f.fullSisters)} জন বোন মিলে ২/৩`}।`, `Sisters: ${f.fullSisters === 1 ? "one sister takes 1/2" : `${f.fullSisters} sisters together take 2/3`}.`); // prettier-ignore
  }

  // ---- 2. Residuary ('asaba): who takes what is left, in order of priority ----
  type Residuary = "children" | "father" | "siblings" | "sistersWithDaughters" | null;
  let residuary: Residuary = null;
  if (hasSon) residuary = "children";
  else if (f.father) residuary = "father";
  else if (siblingsInherit && f.fullBrothers > 0) residuary = "siblings";
  else if (siblingsInherit && daughterSlots > 0 && f.fullSisters > 0)
    residuary = "sistersWithDaughters";

  // ---- 3. 'Awl (shares exceed the estate) or radd (surplus and no residuary) ----
  const fardTotal = Fraction.sum([...fard.values()]);
  if (fard.size === 0 && !residuary) throw new WarishInputError("No heirs given");
  let awl = false;
  let radd = false;
  let spouseRadd = false;
  let residue = Fraction.ONE.sub(fardTotal);
  const final = new Map<Group, Fraction>(fard);

  if (fardTotal.cmp(Fraction.ONE) > 0) {
    awl = true;
    for (const [g, s] of fard) final.set(g, s.div(fardTotal));
    step(`'আউল: নির্ধারিত অংশের যোগফল ${bnFrac(fardTotal)}, যা ১-এর বেশি — সবার অংশ একই হারে কমানো হয়েছে।`, `'Awl: the fixed shares add up to ${fr(fardTotal)}, more than the whole — every share is reduced in the same proportion.`); // prettier-ignore
    residue = Fraction.ZERO;
  } else if (!residue.isZero() && !residuary) {
    radd = true;
    // Radd: the surplus goes back to the blood heirs with fixed shares, not to the spouse.
    const blood = [...fard.entries()].filter(([g]) => g !== "spouse");
    if (blood.length > 0) {
      const bloodTotal = Fraction.sum(blood.map(([, s]) => s));
      for (const [g, s] of blood) final.set(g, s.add(residue.mul(s).div(bloodTotal)));
      step(`রদ্দ: অবশিষ্ট ${bnFrac(residue)} অংশ স্বামী/স্ত্রী ছাড়া অন্য অংশীদারদের মধ্যে তাদের অংশের অনুপাতে ফেরত।`, `Radd: the remaining ${fr(residue)} returns to the sharers other than the spouse, in proportion to their shares.`); // prettier-ignore
    } else {
      // Only a spouse: the remainder returns to the spouse (no other heir to take it).
      spouseRadd = true;
      final.set("spouse", Fraction.ONE);
      step(
        "অন্য কোনো ওয়ারিশ না থাকায় অবশিষ্ট অংশও স্বামী/স্ত্রী পান।",
        "With no other heir, the spouse also takes the rest.",
      );
    }
    residue = Fraction.ZERO;
  }

  // ---- 4. Individual shares ----
  const shares: HeirShare[] = [];
  const push = (
    key: string,
    relation: Relation,
    bn: string,
    en: string,
    share: Fraction,
    basis: string,
  ) => {
    if (!share.isZero())
      shares.push({ key, relation, label_bn: bn, label_en: en, share, basis_bn: basis, basis_en: BASIS_EN[basis] ?? basis }); // prettier-ignore
  };
  const n = (i: number, total: number) => (total > 1 ? ` ${bnNum(i + 1)}` : "");
  /** "son" when there is one, "son-1", "son-2" … when there are several. */
  const k = (base: string, i: number, total: number) => (total > 1 ? `${base}-${i + 1}` : base);
  const ne = (i: number, total: number) => (total > 1 ? ` ${i + 1}` : "");

  if (f.husband)
    push("husband", "husband", "স্বামী", "Husband", final.get("spouse")!, "নির্ধারিত অংশ (ফারায়েজ)");
  for (let i = 0; i < f.wives; i++) {
    push(k("wife", i, f.wives), "wife", `স্ত্রী${n(i, f.wives)}`, `Wife${ne(i, f.wives)}`, each(final.get("spouse")!, f.wives), "নির্ধারিত অংশ, স্ত্রীরা সমান ভাগে"); // prettier-ignore
  }
  if (f.mother) push("mother", "mother", "মা", "Mother", final.get("mother")!, "নির্ধারিত অংশ");
  if (f.father) {
    const fixed = final.get("father") ?? Fraction.ZERO;
    const rest = residuary === "father" ? residue : Fraction.ZERO;
    push("father", "father", "বাবা", "Father", fixed.add(rest), rest.isZero() ? "নির্ধারিত অংশ" : fixed.isZero() ? "অবশিষ্টাংশভোগী ('আসাবা)" : "নির্ধারিত অংশ + অবশিষ্টাংশ"); // prettier-ignore
  }

  // Children: by slot. A predeceased child's slot passes to their own children (MFLO s.4).
  let perSon = Fraction.ZERO;
  let perDaughter = Fraction.ZERO;
  if (residuary === "children") {
    [perSon, perDaughter] = twoToOne(residue, sonSlots, daughterSlots);
    step(`ছেলে-মেয়ে: অবশিষ্ট ${bnFrac(residue)} অংশ ছেলে ২ : মেয়ে ১ অনুপাতে।`, `Sons and daughters: the remaining ${fr(residue)}, son 2 : daughter 1.`); // prettier-ignore
  } else if (daughterSlots > 0) {
    perDaughter = each(final.get("daughters")!, daughterSlots);
  }
  for (let i = 0; i < f.sons; i++) {
    push(
      k("son", i, f.sons),
      "son",
      `ছেলে${n(i, f.sons)}`,
      `Son${ne(i, f.sons)}`,
      perSon,
      "অবশিষ্টাংশ, মেয়ের দ্বিগুণ",
    );
  }
  for (let i = 0; i < f.daughters; i++) {
    push(k("daughter", i, f.daughters), "daughter", `মেয়ে${n(i, f.daughters)}`, `Daughter${ne(i, f.daughters)}`, perDaughter, hasSon ? "অবশিষ্টাংশ, ছেলের অর্ধেক" : "নির্ধারিত অংশ"); // prettier-ignore
  }
  const mflo = pSons.length + pDaughters.length > 0;
  const lines: [PredeceasedChild[], Fraction, string, string, string][] = [
    [pSons, perSon, "pson", "মৃত ছেলে", "Predeceased son"],
    [pDaughters, perDaughter, "pdaughter", "মৃত মেয়ে", "Predeceased daughter"],
  ];
  for (const [list, slotShare, key, bnName, enName] of lines) {
    list.forEach((c, i) => {
      const [g, gd] = twoToOne(slotShare, c.sons, c.daughters);
      const who = `${bnName}${n(i, list.length)}-এর`;
      const whoEn = `${enName}${ne(i, list.length)}'s`;
      for (let j = 0; j < c.sons; j++) push(k(`${key}-${i + 1}-son`, j, c.sons), "grandson", `${who} ছেলে${n(j, c.sons)}`, `${whoEn} son${ne(j, c.sons)}`, g, "মুসলিম পারিবারিক আইন অধ্যাদেশ ১৯৬১, ধারা ৪"); // prettier-ignore
      for (let j = 0; j < c.daughters; j++) push(k(`${key}-${i + 1}-daughter`, j, c.daughters), "granddaughter", `${who} মেয়ে${n(j, c.daughters)}`, `${whoEn} daughter${ne(j, c.daughters)}`, gd, "মুসলিম পারিবারিক আইন অধ্যাদেশ ১৯৬১, ধারা ৪"); // prettier-ignore
    });
  }
  if (mflo) step("মৃত ছেলে/মেয়ের অংশ তাঁদের জীবিত সন্তানরা (২ : ১) পান — মুসলিম পারিবারিক আইন অধ্যাদেশ ১৯৬১, ধারা ৪।", "A predeceased son's or daughter's share goes to their living children (2 : 1) — Muslim Family Laws Ordinance 1961, s.4."); // prettier-ignore

  // Siblings.
  if (residuary === "siblings") {
    const [b, s] = twoToOne(residue, f.fullBrothers, f.fullSisters);
    for (let i = 0; i < f.fullBrothers; i++) push(k("brother", i, f.fullBrothers), "brother", `ভাই${n(i, f.fullBrothers)}`, `Brother${ne(i, f.fullBrothers)}`, b, "অবশিষ্টাংশ"); // prettier-ignore
    for (let i = 0; i < f.fullSisters; i++) push(k("sister", i, f.fullSisters), "sister", `বোন${n(i, f.fullSisters)}`, `Sister${ne(i, f.fullSisters)}`, s, "অবশিষ্টাংশ, ভাইয়ের অর্ধেক"); // prettier-ignore
    step(`ভাইবোন: অবশিষ্ট ${bnFrac(residue)} অংশ ভাই ২ : বোন ১ অনুপাতে।`, `Brothers and sisters: the remaining ${fr(residue)}, brother 2 : sister 1.`); // prettier-ignore
  } else if (residuary === "sistersWithDaughters") {
    for (let i = 0; i < f.fullSisters; i++) push(k("sister", i, f.fullSisters), "sister", `বোন${n(i, f.fullSisters)}`, `Sister${ne(i, f.fullSisters)}`, each(residue, f.fullSisters), "মেয়ের সঙ্গে অবশিষ্টাংশ"); // prettier-ignore
    step(`বোন: মেয়ে থাকায় অবশিষ্ট ${bnFrac(residue)} অংশ পান।`, `Sisters: with daughters present they take the remaining ${fr(residue)}.`); // prettier-ignore
  } else if (sistersFard) {
    for (let i = 0; i < f.fullSisters; i++) push(k("sister", i, f.fullSisters), "sister", `বোন${n(i, f.fullSisters)}`, `Sister${ne(i, f.fullSisters)}`, each(final.get("sisters")!, f.fullSisters), "নির্ধারিত অংশ"); // prettier-ignore
  }
  if (siblings > 0 && !siblingsInherit) {
    step(`ভাইবোন: ${hasSon ? "ছেলে" : "বাবা"} থাকায় তাঁরা অংশ পান না।`, `Brothers and sisters: excluded because there is a ${hasSon ? "son" : "father"}.`); // prettier-ignore
  }

  // Safety net: the shares must add up to exactly the whole estate.
  const total = Fraction.sum(shares.map((s) => s.share));
  if (total.cmp(Fraction.ONE) !== 0) {
    throw new Error(`Internal error: shares add up to ${total.toString()}, not 1`);
  }
  return { shares, flags: { awl, radd, umariyyatayn, mflo, spouseRadd }, steps_bn: steps, steps_en: stepsEn }; // prettier-ignore
}

/** An heir's decimals in one dag = deceased's recorded share × heir's fraction (4 decimal places). */
export function decimalsOf(share: Fraction, holdingDec: number): number {
  const exact = share.mul(new Fraction(Math.round(holdingDec * 10000), 10000));
  return Math.round(exact.toNumber() * 10000) / 10000;
}

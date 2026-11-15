import type { DeedExtract } from "../ai/vision";
import { getSql } from "../sql";
import { DagNotFoundError, resolveDag } from "./ledger";
import { loadDagFacts } from "./records";
import { bn, evaluate, type Reason, type Verdict } from "./rules";

// Cross-check what a deed SAYS (read by the vision model) against what the RECORDS say.
// Everything here is code, not AI: the model only read the paper.

/** Names compared without titles, dots, colons or spacing ("মো: রহিম" = "মোঃ রহিম"). */
export function normalizeName(name: string): string {
  return name
    .replace(/মোহাম্মদ|মুহাম্মদ|মোঃ|মো:|মো\.|মোং|Md\.?|Mohammad/gi, "মো")
    .replace(/[.:ঃ,()\-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function sameName(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const x = normalizeName(a);
  const y = normalizeName(b);
  // A missing or added "মো" title should not make two names different.
  const strip = (s: string) => s.replace(/^মো\s+/, "");
  return x === y || strip(x) === strip(y);
}

export interface DeedCheck {
  verdict: Verdict;
  findings: Reason[];
  summary_bn: string;
  summary_en: string;
  dag: { mouza_bn: string; mouza_en: string; dag_no: number } | null;
}

const TYPE_BN: Record<DeedExtract["deed_type"], string> = {
  sale: "সাফ কবলা (বিক্রয়)",
  heba: "হেবা (দান)",
  baina: "বায়না",
  mortgage: "বন্ধক",
  partition: "বণ্টননামা",
  other: "অন্য ধরনের",
};

const TYPE_EN: Record<DeedExtract["deed_type"], string> = {
  sale: "sale (saf kabla)",
  heba: "gift (heba)",
  baina: "baina (sale agreement)",
  mortgage: "mortgage",
  partition: "partition (bontonnama)",
  other: "other",
};

const money = (n: number) => bn(n.toLocaleString("en-IN"));

/** A plain-Bangla summary built from the fields (no AI wording, so nothing is invented). */
export function deedSummary(d: DeedExtract): string {
  if (!d.is_deed) return "ছবিটি জমির দলিল বলে মনে হচ্ছে না।";
  const parts = [`এটি একটি ${TYPE_BN[d.deed_type]} দলিল`];
  if (d.deed_no) parts[0] += ` (নং ${bn(d.deed_no)})`;
  let s = `${parts[0]}।`;
  if (d.registered_on)
    s += ` ${bn(d.registered_on.split("-").reverse().join("/"))} তারিখে রেজিস্ট্রি হয়েছে।`;
  if (d.seller_name && d.buyer_name) {
    s += ` ${d.seller_name} ${d.mouza ?? ""} মৌজার${d.dag_no ? ` ${bn(d.dag_no)} নম্বর দাগের` : ""}${d.area_dec ? ` ${bn(d.area_dec)} শতক` : ""} জমি ${d.buyer_name}-এর কাছে${d.price_tk ? ` ${money(d.price_tk)} টাকায়` : ""} হস্তান্তর করেছেন।`; // prettier-ignore
  }
  if (d.khatian_no) s += ` দলিলে ${d.khatian_survey ?? ""} খতিয়ান ${bn(d.khatian_no)} উল্লেখ আছে।`;
  if (d.unreadable_fields.length) s += ` কিছু অংশ পড়া যায়নি: ${d.unreadable_fields.join(", ")}।`;
  return s.replace(/\s+/g, " ").trim();
}

/** The same plain summary in English, from the same fields. */
export function deedSummaryEn(d: DeedExtract): string {
  if (!d.is_deed) return "The image does not look like a land deed.";
  let s = `This is a ${TYPE_EN[d.deed_type]} deed${d.deed_no ? ` (no. ${d.deed_no})` : ""}.`;
  if (d.registered_on) s += ` Registered on ${d.registered_on.split("-").reverse().join("/")}.`;
  if (d.seller_name && d.buyer_name) {
    s += ` ${d.seller_name} transferred${d.area_dec ? ` ${d.area_dec} decimals of` : ""} land${d.dag_no ? ` in dag ${d.dag_no}` : ""}${d.mouza ? `, ${d.mouza} mouza,` : ""} to ${d.buyer_name}${d.price_tk ? ` for Tk ${d.price_tk.toLocaleString("en-IN")}` : ""}.`; // prettier-ignore
  }
  if (d.khatian_no) s += ` The deed mentions ${d.khatian_survey ?? ""} khatian ${d.khatian_no}.`;
  if (d.unreadable_fields.length) s += ` Some parts could not be read: ${d.unreadable_fields.join(", ")}.`; // prettier-ignore
  return s.replace(/\s+/g, " ").trim();
}

export async function checkDeed(d: DeedExtract): Promise<DeedCheck> {
  const findings: Reason[] = [];
  const add = (r: Reason) => findings.push(r);
  const summary_bn = deedSummary(d);
  const summary_en = deedSummaryEn(d);

  if (!d.is_deed) {
    add({ code: "NOT_A_DEED", severity: "red", bn: "ছবিটি দলিল নয় বা পড়া যায়নি।", en: "The image is not a readable deed." }); // prettier-ignore
    return { verdict: "red", findings, summary_bn, summary_en, dag: null };
  }
  if (!d.mouza || !d.dag_no) {
    add({ code: "NO_DAG", severity: "red", bn: "দলিলে মৌজা বা দাগ নম্বর পড়া যায়নি; রেকর্ডের সাথে মেলানো সম্ভব নয়।", en: "Mouza or dag number could not be read." }); // prettier-ignore
    return { verdict: "red", findings, summary_bn, summary_en, dag: null };
  }

  // 1. Does the dag exist in the records?
  let mouzaKey = d.mouza;
  try {
    await resolveDag(mouzaKey, d.dag_no);
  } catch (err) {
    if (!(err instanceof DagNotFoundError) || d.jl_no == null) throw err;
    mouzaKey = String(d.jl_no); // e.g. a spelling variant of the mouza name: try the JL number
    try {
      await resolveDag(mouzaKey, d.dag_no);
    } catch {
      add({ code: "DAG_NOT_FOUND", severity: "red", bn: `রেকর্ডে ${d.mouza} মৌজার ${bn(d.dag_no)} নম্বর দাগ পাওয়া যায়নি।`, en: `Dag ${d.dag_no} of ${d.mouza} is not in the records.` }); // prettier-ignore
      return { verdict: "red", findings, summary_bn, summary_en, dag: null };
    }
  }
  const facts = await loadDagFacts(mouzaKey, d.dag_no);
  const dag = {
    mouza_bn: facts.dag.mouza_bn,
    mouza_en: facts.dag.mouza_en,
    dag_no: facts.dag.dag_no,
  };

  // 2. Is the seller on the latest khatian, holding enough?
  const seller = facts.holders.find((h) => sameName(h.name_bn, d.seller_name) || sameName(h.name_en, d.seller_name)); // prettier-ignore
  if (!seller) {
    add({ code: "SELLER_NOT_RECORDED", severity: "red", bn: `বিক্রেতা "${d.seller_name ?? "?"}" এই দাগের সর্বশেষ (বিএস) খতিয়ানে নেই।`, en: "The seller is not on the latest (BS) khatian for this dag.", basis: "ভূমি অপরাধ প্রতিরোধ ও প্রতিকার আইন ২০২৩, ধারা ৪" }); // prettier-ignore
  } else if (d.area_dec != null && d.area_dec > seller.recorded_dec) {
    add({ code: "MORE_THAN_SHARE", severity: "red", bn: `দলিলে ${bn(d.area_dec)} শতক হস্তান্তর, কিন্তু বিক্রেতার রেকর্ডীয় অংশ মাত্র ${bn(seller.recorded_dec)} শতক।`, en: `The deed transfers ${d.area_dec} dec but the seller holds only ${seller.recorded_dec}.`, basis: "ভূমি অপরাধ প্রতিরোধ ও প্রতিকার আইন ২০২৩, ধারা ৪" }); // prettier-ignore
  }

  // 3. Does the khatian on the deed match the seller's latest khatian?
  const bs = facts.chain.find((c) => c.survey === "BS");
  if (
    d.khatian_no != null &&
    bs &&
    (d.khatian_survey ?? "BS") === "BS" &&
    d.khatian_no !== bs.khatian_no
  ) {
    add({ code: "KHATIAN_MISMATCH", severity: "red", bn: `দলিলে বিএস খতিয়ান ${bn(d.khatian_no)}, কিন্তু রেকর্ডে এই দাগ খতিয়ান ${bn(bs.khatian_no)}-এ।`, en: `Deed says BS khatian ${d.khatian_no}; records say ${bs.khatian_no}.` }); // prettier-ignore
  }

  // 4. Is this deed in the registry records, and do its details match?
  if (d.deed_no) {
    const sql = getSql();
    const [rec] = await sql<
      {
        registered_on: string;
        area_dec: number;
        dag_no: number;
        seller_bn: string;
        buyer_bn: string;
      }[]
    >`
      select to_char(d.registered_on, 'YYYY-MM-DD') as registered_on, d.area_dec::float8 as area_dec,
             g.dag_no, s.name_bn as seller_bn, b.name_bn as buyer_bn
      from deeds d join dags g on g.id = d.dag_id
      join owners s on s.id = d.seller_owner_id join owners b on b.id = d.buyer_owner_id
      where d.deed_no = ${d.deed_no}`;
    if (!rec) {
      add({ code: "DEED_NOT_IN_REGISTRY", severity: "amber", bn: `দলিল নং ${bn(d.deed_no)} রেজিস্ট্রি রেকর্ডে পাওয়া যায়নি। সাব-রেজিস্ট্রি অফিসে মিলিয়ে দেখুন।`, en: `Deed ${d.deed_no} is not in the registry records.` }); // prettier-ignore
    } else {
      const diffs: [boolean, string, string][] = [
        [rec.dag_no !== d.dag_no, `দাগ (রেকর্ডে ${bn(rec.dag_no)})`, `dag (record ${rec.dag_no})`],
        [d.area_dec != null && Math.abs(rec.area_dec - d.area_dec) > 0.001, `জমির পরিমাণ (রেকর্ডে ${bn(rec.area_dec)} শতক)`, `area (record ${rec.area_dec})`], // prettier-ignore
        [d.registered_on != null && rec.registered_on !== d.registered_on, `তারিখ (রেকর্ডে ${bn(rec.registered_on.split("-").reverse().join("/"))})`, `date (record ${rec.registered_on})`], // prettier-ignore
        [!sameName(rec.seller_bn, d.seller_name), `বিক্রেতা (রেকর্ডে ${rec.seller_bn})`, "seller"],
        [!sameName(rec.buyer_bn, d.buyer_name), `ক্রেতা (রেকর্ডে ${rec.buyer_bn})`, "buyer"],
      ];
      const bad = diffs.filter(([x]) => x);
      if (bad.length) {
        add({ code: "DEED_DETAILS_DIFFER", severity: "amber", bn: `দলিলের কিছু তথ্য রেজিস্ট্রি রেকর্ডের সাথে মেলেনি: ${bad.map((b) => b[1]).join("; ")}। মূল দলিল দেখে নিশ্চিত হোন (ছবি থেকে পড়ায় ভুলও হতে পারে)।`, en: `Some details differ from the registry record: ${bad.map((b) => b[2]).join("; ")}.` }); // prettier-ignore
      }
    }
  }

  // 5. Everything Jomi Check knows about this dag (map mismatch, mutation, case, khas, mortgage…).
  const dagCheck = evaluate(facts, {});
  for (const r of dagCheck.reasons) if (r.code !== "CLEAR") findings.push(r);

  const verdict: Verdict = findings.some((f) => f.severity === "red")
    ? "red"
    : findings.some((f) => f.severity === "amber")
      ? "amber"
      : "green";
  if (verdict === "green") {
    findings.unshift({ code: "DEED_MATCHES", severity: "info", bn: "দলিলের তথ্য রেকর্ডের সাথে মিলেছে; দাগে কোনো ঝুঁকি পাওয়া যায়নি।", en: "The deed matches the records; no risk found on the dag." }); // prettier-ignore
  }
  return { verdict, findings, summary_bn, summary_en, dag };
}

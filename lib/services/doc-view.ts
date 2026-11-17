import type { DocPayload } from "../engines/documents";

// How a signed document reads on screen and on paper, in both languages. Pure, so the
// application page (server) and /verify/doc (browser) show the same words.

const bnd = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
const SURVEY_BN = { CS: "সিএস", SA: "এসএ", RS: "আরএস", BS: "বিএস" } as const;

export interface DocView {
  heading_bn: string;
  heading_en: string;
  title_bn: string;
  title_en: string;
  lines: { bn: string; en: string }[];
  table: { name_bn: string; name_en: string; value_bn: string; value_en: string }[];
  table_head: { name_bn: string; name_en: string; value_bn: string; value_en: string };
}

export function describeDoc(p: DocPayload): DocView {
  const place = {
    bn: `${p.mouza_bn} মৌজা, জে.এল. ${bnd(p.jl_no)} · দাগ ${bnd(p.dag_no)}`,
    en: `${p.mouza_en} mouza, JL ${p.jl_no} · dag ${p.dag_no}`,
  };
  const foot = {
    bn: `আবেদন ${p.app_no} · ডকুমেন্ট আইডি ${p.id} · স্বাক্ষর ${bnd(p.issued_at.slice(0, 10))}`,
    en: `Application ${p.app_no} · document id ${p.id} · signed ${p.issued_at.slice(0, 10)}`,
  };
  if (p.kind === "dakhila") {
    const years = p.years.length > 1 ? `${p.years[0]} … ${p.years.at(-1)}` : (p.years[0] ?? p.through_fy); // prettier-ignore
    return {
      heading_bn: "ভূমিসাথী · ভূমি উন্নয়ন করের দাখিলা (প্রোটোটাইপ, কৃত্রিম তথ্য)",
      heading_en: "BhumiSathi · land development tax receipt (prototype, synthetic data)",
      title_bn: `দাখিলা: ${p.holder_bn}`,
      title_en: `Dakhila: ${p.holder_en}`,
      lines: [
        { bn: `${place.bn} · অংশ ${bnd(p.share_dec)} শতক`, en: `${place.en} · share ${p.share_dec} dec` }, // prettier-ignore
        { bn: `অর্থবছর ${bnd(years)} · ${bnd(p.through_fy)} পর্যন্ত পরিশোধিত`, en: `Fiscal years ${years} · paid through ${p.through_fy}` }, // prettier-ignore
        p.exempt
          ? { bn: "করমুক্ত (কৃষিজমি ২৫ বিঘা পর্যন্ত) — পরিশোধ ০ টাকা", en: "Exempt (farmland up to 25 bigha) — Tk 0 paid" } // prettier-ignore
          : { bn: `পরিশোধ ${bnd(p.amount_tk)} টাকা (পরীক্ষামূলক)${p.txn_ref ? ` · রসিদ ${p.txn_ref}` : ""}`, en: `Paid Tk ${p.amount_tk} (sandbox)${p.txn_ref ? ` · receipt ${p.txn_ref}` : ""}` }, // prettier-ignore
        foot,
      ],
      table: [],
      table_head: { name_bn: "", name_en: "", value_bn: "", value_en: "" },
    };
  }
  const mutation = p.kind === "mutation_khatian";
  return {
    heading_bn: `ভূমিসাথী · ${mutation ? "নামজারি খতিয়ান" : "স্বাক্ষরিত কপি"} (প্রোটোটাইপ, কৃত্রিম তথ্য)`,
    heading_en: `BhumiSathi · ${mutation ? "mutation khatian" : "signed copy"} (prototype, synthetic data)`,
    title_bn: `${SURVEY_BN[p.survey]} খতিয়ান নং ${bnd(p.khatian_no)} (${bnd(p.year)})`,
    title_en: `${p.survey} khatian no. ${p.khatian_no} (${p.year})`,
    lines: [
      { bn: `${place.bn} · ${bnd(p.area_dec)} শতক`, en: `${place.en} · ${p.area_dec} decimals` },
      ...(mutation
        ? [{ bn: `দলিল ${bnd(p.deed_no ?? "")}${p.case_no ? ` · নামজারি মামলা ${p.case_no}` : ""}`, en: `Deed ${p.deed_no}${p.case_no ? ` · mutation case ${p.case_no}` : ""}` }] // prettier-ignore
        : []),
      foot,
    ],
    table: p.owners.map((o) => ({ name_bn: o.name_bn, name_en: o.name_en, value_bn: bnd(o.share_dec), value_en: String(o.share_dec) })), // prettier-ignore
    table_head: { name_bn: "মালিক", name_en: "Holder", value_bn: "অংশ (শতক)", value_en: "Share (dec)" }, // prettier-ignore
  };
}

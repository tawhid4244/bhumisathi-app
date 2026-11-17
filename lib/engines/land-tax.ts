import type postgres from "postgres";
import rules from "../../content/land-tax.json";
import { getSql } from "../sql";
import { resolveDag } from "./ledger";
import { fiscalYearStart } from "./rules";

// Land development tax (ভূমি উন্নয়ন কর): who holds a dag, which fiscal years are unpaid, and how much.
// The rates and the exemption live in content/land-tax.json with their sources and a "verified"
// note. Paying (through the application framework) updates land_tax, which feeds the
// "tax arrears" rule of Jomi Check.

export const LAND_TAX_RULES = rules;

/** "2026-27" for a fiscal year that starts in July 2026. */
export const fyLabel = (start: number) => `${start}-${String((start + 1) % 100).padStart(2, "0")}`;

/** Fiscal years after `paidThrough` up to and including the current one. */
export function yearsDue(paidThrough: string, today = new Date()): string[] {
  const from = Number(paidThrough.slice(0, 4)) + 1;
  const to = fiscalYearStart(today);
  const out: string[] = [];
  for (let y = from; y <= to; y++) out.push(fyLabel(y));
  return out;
}

export interface TaxLine {
  owner_id: number;
  name_bn: string;
  name_en: string;
  share_dec: number;
  agricultural: boolean;
  /** The holder's agricultural land across all dags in the records (for the 25-bigha rule). */
  family_agri_dec: number;
  exempt: boolean;
  rate_tk_per_dec: number;
  annual_tk: number;
  paid_through_fy: string;
  years_due: string[];
  due_tk: number;
  basis_bn: string;
  basis_en: string;
}

export interface TaxReport {
  mouza_bn: string;
  mouza_en: string;
  dag_no: number;
  dag_id: number;
  land_class_bn: string;
  land_class_en: string;
  current_fy: string;
  holders: TaxLine[];
  note_bn: string;
  note_en: string;
  source: string;
  verified: string;
}

/** Pure part: the tax for one holder of one dag. Tested in tests/unit/land-tax.test.ts. */
export function taxFor(args: {
  landClassEn: string;
  shareDec: number;
  familyAgriDec: number;
  paidThroughFy: string;
  today?: Date;
}): Omit<TaxLine, "owner_id" | "name_bn" | "name_en" | "share_dec" | "paid_through_fy"> {
  const agricultural = rules.agricultural.classes_en.includes(args.landClassEn);
  const years = yearsDue(args.paidThroughFy, args.today);
  let rate: number;
  let exempt = false;
  let basis_bn: string;
  let basis_en: string;
  if (agricultural) {
    exempt = args.familyAgriDec <= rules.agricultural.exempt_up_to_dec;
    rate = exempt ? 0 : rules.agricultural.rate_tk_per_dec_above;
    basis_bn = exempt
      ? rules.agricultural.exempt_bn
      : "২৫ বিঘার বেশি কৃষিজমি: পুরো জমিতে কর (উদাহরণ হার)।";
    basis_en = exempt ? rules.agricultural.exempt_en : "Over 25 bigha of farmland: tax on the whole holding (example rate)."; // prettier-ignore
  } else {
    const use = (rules.non_agricultural.class_use as Record<string, string>)[args.landClassEn] ?? "residential"; // prettier-ignore
    const r = rules.non_agricultural.rates.find((x) => x.use === use)!;
    rate = r.tk_per_dec;
    basis_bn = `অকৃষি (${r.bn}): শতাংশপ্রতি ${r.tk_per_dec} টাকা — উদাহরণ হার, যাচাই করা হয়নি।`;
    basis_en = `Non-agricultural (${r.en}): Tk ${r.tk_per_dec} per decimal — example rate, not verified.`; // prettier-ignore
  }
  const annual = Math.ceil(rate * args.shareDec);
  return {
    agricultural,
    family_agri_dec: args.familyAgriDec,
    exempt,
    rate_tk_per_dec: rate,
    annual_tk: annual,
    years_due: years,
    due_tk: annual * years.length,
    basis_bn,
    basis_en,
  };
}

export async function landTaxReport(
  mouza: string,
  dagNo: number,
  today = new Date(),
): Promise<TaxReport> {
  // prettier-ignore
  const dag = await resolveDag(mouza, dagNo);
  const rows = await getSql()<
    { owner_id: number; name_bn: string; name_en: string; share_dec: number; paid_through_fy: string | null; family_agri_dec: number }[] // prettier-ignore
  >`
    select h.owner_id, o.name_bn, o.name_en, h.recorded_dec::float8 as share_dec, t.paid_through_fy,
           coalesce((select sum(h2.recorded_dec) from bs_holdings h2 join dags d2 on d2.id = h2.dag_id
                     where h2.owner_id = h.owner_id
                       and d2.land_class_en = any(${rules.agricultural.classes_en}::text[])), 0)::float8 as family_agri_dec
    from bs_holdings h join owners o on o.id = h.owner_id
    left join land_tax t on t.dag_id = h.dag_id and t.owner_id = h.owner_id
    where h.dag_id = ${dag.id} and o.kind <> 'government'
    order by h.owner_id`;
  const current = fyLabel(fiscalYearStart(today));
  return {
    mouza_bn: dag.mouza_bn,
    mouza_en: dag.mouza_en,
    dag_no: dag.dag_no,
    dag_id: dag.id,
    land_class_bn: dag.land_class_bn,
    land_class_en: dag.land_class_en,
    current_fy: current,
    holders: rows.map((r) => {
      // Never registered for tax: the current fiscal year is due.
      const paid = r.paid_through_fy ?? fyLabel(fiscalYearStart(today) - 1);
      return {
        owner_id: r.owner_id,
        name_bn: r.name_bn,
        name_en: r.name_en,
        share_dec: r.share_dec,
        paid_through_fy: paid,
        ...taxFor({ landClassEn: dag.land_class_en, shareDec: r.share_dec, familyAgriDec: r.family_agri_dec, paidThroughFy: paid, today }), // prettier-ignore
      };
    }),
    note_bn: rules.note_bn,
    note_en: rules.note_en,
    source: `${rules.agricultural.source}; ${rules.non_agricultural.source}`,
    verified: `${rules.agricultural.verified} ${rules.non_agricultural.verified}`,
  };
}

/** Record that a holder has paid (or, if exempt, been cleared) through a fiscal year. */
export async function markTaxPaid(
  tx: postgres.Sql | postgres.TransactionSql,
  dagId: number,
  ownerId: number,
  throughFy: string,
) {
  await tx`insert into land_tax (dag_id, owner_id, paid_through_fy, last_paid_on, is_synthetic)
           values (${dagId}, ${ownerId}, ${throughFy}, bd_today(), true)
           on conflict (dag_id, owner_id) do update
             set paid_through_fy = excluded.paid_through_fy, last_paid_on = excluded.last_paid_on`;
}

/** The holdings of the land holder an account stands for (users.owner_id). */
export async function holdingsOf(ownerId: number) {
  return getSql()<
    { mouza_bn: string; mouza_en: string; dag_no: number; share_dec: number; paid_through_fy: string | null }[] // prettier-ignore
  >`
    select m.name_bn as mouza_bn, m.name_en as mouza_en, d.dag_no, h.recorded_dec::float8 as share_dec, t.paid_through_fy
    from bs_holdings h join dags d on d.id = h.dag_id join mouzas m on m.id = d.mouza_id
    left join land_tax t on t.dag_id = h.dag_id and t.owner_id = h.owner_id
    where h.owner_id = ${ownerId} order by m.jl_no, d.dag_no`;
}

import { getSql } from "../sql";
import { computeWarish, decimalsOf, type Family } from "./warish";

// Warish per dag: the deceased's land on the latest (BS) khatian × each heir's fraction.

export interface Holding {
  mouza_bn: string;
  mouza_en: string;
  dag_no: number;
  share_dec: number;
}

export interface DeceasedOwner {
  owner_id: number;
  name_bn: string;
  name_en: string;
  died_on: string | null;
  holdings: Holding[];
}

/** Deceased owners who still hold land on a BS khatian (their heirs need warish + mutation). */
export async function listDeceasedWithLand(): Promise<DeceasedOwner[]> {
  const sql = getSql();
  const rows = await sql<(Omit<DeceasedOwner, "holdings"> & Holding)[]>`
    select o.id as owner_id, o.name_bn, o.name_en, to_char(o.died_on, 'YYYY-MM-DD') as died_on,
           mz.name_bn as mouza_bn, mz.name_en as mouza_en, d.dag_no, h.recorded_dec::float8 as share_dec
    from bs_holdings h
    join owners o on o.id = h.owner_id and o.is_deceased
    join dags d on d.id = h.dag_id
    join mouzas mz on mz.id = d.mouza_id
    order by o.id, d.dag_no`;
  const byOwner = new Map<number, DeceasedOwner>();
  for (const r of rows) {
    const o = byOwner.get(r.owner_id) ?? { owner_id: r.owner_id, name_bn: r.name_bn, name_en: r.name_en, died_on: r.died_on, holdings: [] }; // prettier-ignore
    o.holdings.push({ mouza_bn: r.mouza_bn, mouza_en: r.mouza_en, dag_no: r.dag_no, share_dec: r.share_dec }); // prettier-ignore
    byOwner.set(r.owner_id, o);
  }
  return [...byOwner.values()];
}

export class DeceasedNotFoundError extends Error {}

export interface WarishLandResult {
  deceased: Omit<DeceasedOwner, "holdings"> | null;
  holdings: Holding[];
  shares: {
    key: string;
    relation: string;
    label_bn: string;
    label_en: string;
    fraction: string;
    percent: number;
    basis_bn: string;
    basis_en: string;
    per_dag: { mouza_bn: string; dag_no: number; decimals: number }[];
    total_dec: number;
  }[];
  flags: { awl: boolean; radd: boolean; umariyyatayn: boolean; mflo: boolean; spouseRadd: boolean };
  steps_bn: string[];
  steps_en: string[];
}

/**
 * Compute shares for a family. With a deceased owner id, every heir also gets decimals in each of
 * the deceased's dags; with total_dec, decimals of that total; otherwise fractions only.
 */
export async function computeWarishLand(args: {
  family: Family;
  deceased_owner_id?: number;
  total_dec?: number;
}): Promise<WarishLandResult> {
  let deceased: DeceasedOwner | null = null;
  if (args.deceased_owner_id != null) {
    deceased = (await listDeceasedWithLand()).find((d) => d.owner_id === args.deceased_owner_id) ?? null; // prettier-ignore
    if (!deceased) throw new DeceasedNotFoundError("No deceased owner with land has that id.");
  }
  const holdings: Holding[] =
    deceased?.holdings ??
    (args.total_dec ? [{ mouza_bn: "মোট জমি", mouza_en: "Total land", dag_no: 0, share_dec: args.total_dec }] : []); // prettier-ignore
  const r = computeWarish(args.family);
  return {
    deceased: deceased ? { owner_id: deceased.owner_id, name_bn: deceased.name_bn, name_en: deceased.name_en, died_on: deceased.died_on } : null, // prettier-ignore
    holdings,
    shares: r.shares.map((s) => {
      const per_dag = holdings.map((h) => ({ mouza_bn: h.mouza_bn, dag_no: h.dag_no, decimals: decimalsOf(s.share, h.share_dec) })); // prettier-ignore
      return {
        key: s.key,
        relation: s.relation,
        label_bn: s.label_bn,
        label_en: s.label_en,
        fraction: s.share.toString(),
        percent: Math.round(s.share.toNumber() * 1e6) / 1e4,
        basis_bn: s.basis_bn,
        basis_en: s.basis_en,
        per_dag,
        total_dec: Math.round(per_dag.reduce((a, p) => a + p.decimals, 0) * 1e4) / 1e4,
      };
    }),
    flags: r.flags,
    steps_bn: r.steps_bn,
    steps_en: r.steps_en,
  };
}

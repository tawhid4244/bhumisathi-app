import { getSql } from "../sql";
import { polygonAreaDecimals, round, type Point } from "./area";
import { getLedgerStatus, type DagInfo, type HolderBalance } from "./ledger";

// Loads every fact about one dag that the Jomi Check rules need, in one place.
// The rules themselves (rules.ts) are pure functions over this object, so they are easy to test.

export interface ChainEntry {
  survey: "CS" | "SA" | "RS" | "BS";
  year: number;
  khatian_no: number;
  survey_dag_no: number;
  area_dec: number;
  owners: { name_bn: string; name_en: string; share_dec: number }[];
}

export interface DagFacts {
  dag: DagInfo;
  holders: HolderBalance[];
  chain: ChainEntry[];
  khas: { category_bn: string; category_en: string } | null;
  cases: {
    case_no: string;
    court_bn: string;
    court_en: string;
    status: string;
    summary_bn: string;
    summary_en: string;
  }[];
  liens: { id: string; area_dec: number; lender_bn: string; lender_en: string; owner_id: number }[];
  bainas: { id: string; area_dec: number; buyer_bn: string; expires_on: string }[];
  /** Deeds registered after the latest khatian, with their mutation status if any. */
  unmutated_deeds: {
    deed_no: string;
    registered_on: string;
    area_dec: number;
    seller_bn: string;
    buyer_bn: string;
    mutation_case: string | null;
    mutation_status: string | null;
  }[];
  tax: { owner_id: number; name_bn: string; paid_through_fy: string }[];
  map_area_dec: number | null;
  /** Sale attempts the ledger refused in the last 90 days. */
  blocked_attempts: { area_dec: number; reason_bn: string; reason_en: string; on: string }[];
}

export async function loadDagFacts(mouza: string, dagNo: number): Promise<DagFacts> {
  const sql = getSql();
  const status = await getLedgerStatus(mouza, dagNo);
  const id = status.dag.id;

  const [chainRows, khas, cases, deeds, tax, poly, attempts] = await Promise.all([
    sql<(Omit<ChainEntry, "owners"> & { owners: ChainEntry["owners"] })[]>`
      select k.survey, k.prepared_year as year, k.khatian_no, kd.survey_dag_no,
             kd.area_dec::float8 as area_dec,
             coalesce((select json_agg(json_build_object('name_bn', o.name_bn, 'name_en', o.name_en,
                                'share_dec', s.share_dec::float8) order by o.id)
                       from ownership_shares s join owners o on o.id = s.owner_id
                       where s.khatian_id = k.id and s.dag_id = kd.dag_id), '[]') as owners
      from khatian_dags kd join khatians k on k.id = kd.khatian_id
      where kd.dag_id = ${id}
      order by array_position(array['CS','SA','RS','BS'], k.survey)`,
    sql<{ category_bn: string; category_en: string }[]>`
      select category_bn, category_en from khas_flags where dag_id = ${id}`,
    sql<DagFacts["cases"]>`
      select case_no, court_bn, court_en, status, summary_bn, summary_en
      from court_cases where dag_id = ${id} order by filed_on`,
    sql<DagFacts["unmutated_deeds"]>`
      select d.deed_no, to_char(d.registered_on, 'YYYY-MM-DD') as registered_on,
             d.area_dec::float8 as area_dec, s.name_bn as seller_bn, b.name_bn as buyer_bn,
             m.case_no as mutation_case, m.status as mutation_status
      from deeds d
      join owners s on s.id = d.seller_owner_id
      join owners b on b.id = d.buyer_owner_id
      left join mutation_cases m on m.deed_id = d.id
      where d.dag_id = ${id} and d.after_latest_khatian
        and coalesce(m.status, 'none') <> 'approved'
      order by d.registered_on`,
    sql<DagFacts["tax"]>`
      select t.owner_id, o.name_bn, t.paid_through_fy
      from land_tax t join owners o on o.id = t.owner_id
      where t.dag_id = ${id} order by t.owner_id`,
    sql<{ points: Point[]; units_per_inch: number; scale: number | null }[]>`
      select p.points, p.units_per_inch, m.map_scale_in_per_mile as scale
      from map_polygons p join dags d on d.id = p.dag_id join mouzas m on m.id = d.mouza_id
      where p.dag_id = ${id}`,
    sql<DagFacts["blocked_attempts"]>`
      select area_dec::float8 as area_dec, reason_bn, reason_en,
             to_char(created_at at time zone 'Asia/Dhaka', 'YYYY-MM-DD') as on
      from ledger_events
      where dag_id = ${id} and event_type = 'sale' and status = 'rejected'
        and reason_en like 'Requested area exceeds%'
        and created_at > now() - interval '90 days'
      order by id desc`,
  ]);

  const p = poly[0];
  return {
    dag: status.dag,
    holders: status.holders,
    chain: chainRows,
    khas: khas[0] ?? null,
    cases,
    liens: status.active_liens.map((l) => ({
      id: l.id,
      area_dec: l.area_dec,
      lender_bn: l.lender_bn,
      lender_en: l.lender_en,
      owner_id: l.owner_id,
    })),
    bainas: status.active_bainas.map((b) => ({
      id: b.id,
      area_dec: b.area_dec,
      buyer_bn: b.buyer_bn,
      expires_on: b.expires_on,
    })),
    unmutated_deeds: deeds,
    tax,
    map_area_dec: p
      ? round(polygonAreaDecimals(p.points, p.units_per_inch, p.scale ?? 16), 2)
      : null,
    blocked_attempts: attempts,
  };
}

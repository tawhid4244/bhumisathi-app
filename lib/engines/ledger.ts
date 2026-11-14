import { getSql } from "../sql";

// Share ledger engine. The balance rule lives in the database (views share_balances /
// share_sellable and the function register_event); this file reads it and calls it.
// computeSellable() repeats the formula in TypeScript so it can be unit-tested and explained,
// and an integration test checks the two always agree.

export interface BalanceParts {
  recorded: number;
  sold: number;
  reserved: number;
  locked: number;
  /** Whole-dag lock: khas land, pending court case, or deceased recorded owner. */
  blocked: boolean;
}

/** sellable = recorded share − registered sales − active bainas − locked portions (never below 0). */
export function computeSellable(p: BalanceParts): number {
  if (p.blocked) return 0;
  const raw = p.recorded - p.sold - p.reserved - p.locked;
  return Math.max(0, Math.round(raw * 100) / 100);
}

export interface DagInfo {
  id: number;
  mouza_id: number;
  mouza_bn: string;
  mouza_en: string;
  jl_no: number;
  dag_no: number;
  recorded_area_dec: number;
  land_class_bn: string;
  land_class_en: string;
  version: number;
  is_khas: boolean;
  pending_cases: string | null;
}

export interface HolderBalance {
  owner_id: number;
  name_bn: string;
  name_en: string;
  is_deceased: boolean;
  recorded_dec: number;
  sold_dec: number;
  reserved_dec: number;
  locked_dec: number;
  sellable_dec: number;
}

export interface LedgerStatus {
  dag: DagInfo;
  holders: HolderBalance[];
  active_bainas: {
    id: string;
    seller_id: number;
    buyer_id: number;
    buyer_bn: string;
    area_dec: number;
    expires_on: string;
  }[];
  active_liens: {
    id: string;
    owner_id: number;
    lender_bn: string;
    lender_en: string;
    area_dec: number;
    loan_ref: string;
  }[];
  recent_events: {
    id: number;
    event_type: string;
    status: string;
    area_dec: number;
    ref: string | null;
    reason_bn: string | null;
    created_at: string;
  }[];
}

export class DagNotFoundError extends Error {
  constructor(mouza: string, dagNo: number) {
    super(`Dag ${dagNo} not found in mouza "${mouza}".`);
    this.name = "DagNotFoundError";
  }
}

/** Bangla digits → Western digits, so "নয়াপাড়া ৪৫" and "45" both work. */
export function westernDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
}

/** Find a dag by mouza (name in Bangla or English, code, or JL number) and dag number. */
export async function resolveDag(mouza: string, dagNo: number): Promise<DagInfo> {
  const sql = getSql();
  const m = westernDigits(mouza.trim()).toLowerCase();
  const jl = /^\d+$/.test(m) ? Number(m) : -1;
  const rows = await sql<DagInfo[]>`
    select d.id, d.mouza_id, mz.name_bn as mouza_bn, mz.name_en as mouza_en, mz.jl_no, d.dag_no,
           d.recorded_area_dec::float8 as recorded_area_dec, d.land_class_bn, d.land_class_en,
           d.ledger_version as version, dl.is_khas, dl.pending_cases
    from dags d
    join mouzas mz on mz.id = d.mouza_id
    join dag_locks dl on dl.dag_id = d.id
    where d.dag_no = ${dagNo}
      and (lower(mz.name_en) = ${m} or mz.name_bn = ${mouza.trim()} or lower(mz.code) = ${m}
           or mz.jl_no = ${jl})`;
  if (rows.length === 0) throw new DagNotFoundError(mouza, dagNo);
  return rows[0]!;
}

export async function getLedgerStatus(mouza: string, dagNo: number): Promise<LedgerStatus> {
  const sql = getSql();
  const dag = await resolveDag(mouza, dagNo);
  const [holders, active_bainas, active_liens, recent_events] = await Promise.all([
    sql<HolderBalance[]>`
      select s.owner_id, o.name_bn, o.name_en, s.is_deceased,
             s.recorded_dec::float8 as recorded_dec, s.sold_dec::float8 as sold_dec,
             s.reserved_dec::float8 as reserved_dec, s.locked_dec::float8 as locked_dec,
             s.sellable_dec::float8 as sellable_dec
      from share_sellable s join owners o on o.id = s.owner_id
      where s.dag_id = ${dag.id} order by s.owner_id`,
    sql<LedgerStatus["active_bainas"]>`
      select b.id, b.seller_owner_id as seller_id, b.buyer_owner_id as buyer_id, o.name_bn as buyer_bn,
             b.area_dec::float8 as area_dec, to_char(b.expires_on, 'YYYY-MM-DD') as expires_on
      from bainas b join owners o on o.id = b.buyer_owner_id
      where b.dag_id = ${dag.id} and b.status = 'active' and b.expires_on >= bd_today()
      order by b.id`,
    sql<LedgerStatus["active_liens"]>`
      select l.id, l.owner_id, o.name_bn as lender_bn, o.name_en as lender_en,
             l.area_dec::float8 as area_dec, l.loan_ref
      from liens l join owners o on o.id = l.lender_owner_id
      where l.dag_id = ${dag.id} and l.status = 'active' order by l.id`,
    sql<LedgerStatus["recent_events"]>`
      select id::int, event_type, status, area_dec::float8 as area_dec, ref, reason_bn,
             to_char(created_at at time zone 'Asia/Dhaka', 'YYYY-MM-DD HH24:MI') as created_at
      from ledger_events where dag_id = ${dag.id} order by id desc limit 10`,
  ]);
  return { dag, holders, active_bainas, active_liens, recent_events };
}

export interface RegisterResult {
  ok: boolean;
  event_id?: number;
  ref?: string;
  mutation_case?: string | null;
  reason_bn?: string;
  reason_en?: string;
  version: number;
}

type EventType = "baina" | "sale" | "lien";

/** The ONLY way the app writes to the ledger: the row-locked SQL function register_event(). */
export async function registerEvent(args: {
  type: EventType;
  mouza: string;
  dagNo: number;
  ownerId: number;
  counterpartyId: number;
  area: number;
  days?: number;
  ref?: string;
}): Promise<RegisterResult> {
  const sql = getSql();
  const dag = await resolveDag(args.mouza, args.dagNo);
  const [row] = await sql<{ r: RegisterResult }[]>`
    select register_event(${args.type}, ${dag.id}, ${args.ownerId}, ${args.counterpartyId},
                          ${args.area}, ${args.days ?? 90}, ${args.ref ?? null}) as r`;
  return row!.r;
}

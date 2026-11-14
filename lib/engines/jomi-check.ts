import { getSql } from "../sql";
import { resolveDag, westernDigits } from "./ledger";
import { loadDagFacts, type ChainEntry } from "./records";
import {
  DISCLAIMER,
  evaluate,
  VERDICT_LABEL,
  type CheckContext,
  type Reason,
  type Verdict,
} from "./rules";
import type { DagInfo, HolderBalance } from "./ledger";

// Jomi Check: load facts → run rules → one report. Used by /check, /registry and the agent.

export interface JomiReport {
  verdict: Verdict;
  verdict_bn: string;
  verdict_en: string;
  advice_bn: string;
  dag: DagInfo;
  reasons: Reason[];
  chain: ChainEntry[];
  holders: HolderBalance[];
  map_area_dec: number | null;
  ledger_version: number;
  checked_on: string;
  disclaimer_bn: string;
  disclaimer_en: string;
  /** When looked up by khatian: every dag listed on it. */
  khatian_dags: number[] | null;
}

export class KhatianNotFoundError extends Error {
  constructor(mouza: string, no: number) {
    super(`BS khatian ${no} not found in mouza "${mouza}".`);
    this.name = "KhatianNotFoundError";
  }
}

/** Dags listed on a BS khatian of a mouza. */
export async function dagsOnKhatian(mouza: string, khatianNo: number): Promise<number[]> {
  const sql = getSql();
  const m = westernDigits(mouza.trim()).toLowerCase();
  const rows = await sql<{ dag_no: number }[]>`
    select d.dag_no from khatians k
    join mouzas mz on mz.id = k.mouza_id
    join khatian_dags kd on kd.khatian_id = k.id
    join dags d on d.id = kd.dag_id
    where k.survey = 'BS' and k.khatian_no = ${khatianNo}
      and (lower(mz.name_en) = ${m} or mz.name_bn = ${mouza.trim()} or lower(mz.code) = ${m}
           or mz.jl_no::text = ${m})
    order by d.dag_no`;
  return rows.map((r) => r.dag_no);
}

export async function jomiCheck(args: {
  mouza: string;
  dag_no?: number;
  khatian_no?: number;
  context?: CheckContext;
}): Promise<JomiReport> {
  let dagNo = args.dag_no;
  let khatianDags: number[] | null = null;
  if (dagNo == null && args.khatian_no != null) {
    khatianDags = await dagsOnKhatian(args.mouza, args.khatian_no);
    if (khatianDags.length === 0) throw new KhatianNotFoundError(args.mouza, args.khatian_no);
    dagNo = khatianDags[0]!;
  }
  if (dagNo == null) throw new Error("Give a dag number or a khatian number.");
  await resolveDag(args.mouza, dagNo); // throws DagNotFoundError with a clear message
  const today = args.context?.today ?? new Date();
  const facts = await loadDagFacts(args.mouza, dagNo);
  const { verdict, reasons } = evaluate(facts, { ...args.context, today });
  const label = VERDICT_LABEL[verdict];
  return {
    verdict,
    verdict_bn: label.bn,
    verdict_en: label.en,
    advice_bn: label.advice_bn,
    dag: facts.dag,
    reasons,
    chain: facts.chain,
    holders: facts.holders,
    map_area_dec: facts.map_area_dec,
    ledger_version: facts.dag.version,
    checked_on: today.toISOString().slice(0, 10),
    disclaimer_bn: DISCLAIMER.bn,
    disclaimer_en: DISCLAIMER.en,
    khatian_dags: khatianDags,
  };
}

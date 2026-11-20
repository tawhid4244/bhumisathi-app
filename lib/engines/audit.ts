import { createHash } from "node:crypto";
import { withUser } from "../auth/db";
import type { SessionUser } from "../auth/roles";
import { getSql } from "../sql";

// Hash-chained audit log. Every view and write through a tool appends one entry; each entry's
// hash covers the previous hash, so nobody can quietly edit, insert or delete history.
//
//   body = canonical JSON of {v, at, actor, role, action, dag_id, detail}
//   hash = sha256(prev_hash + body)          (the first entry links to 64 zeros)
//
// Appending happens in SQL (append_audit) under a lock so the chain never forks.

export const GENESIS = "0".repeat(64);

export interface AuditInput {
  user: SessionUser | null;
  action: string;
  dag_id?: number | null;
  detail?: Record<string, string | number | boolean | null>;
}

/** Key order is fixed here, so the same entry always hashes the same way. */
export function auditBody(e: AuditInput, at: Date = new Date()): string {
  return JSON.stringify({
    v: 1,
    at: at.toISOString(),
    actor: e.user?.id ?? null,
    role: e.user?.role ?? "public",
    action: e.action,
    dag_id: e.dag_id ?? null,
    detail: e.detail ?? {},
  });
}

export const chainHash = (prev: string, body: string) =>
  createHash("sha256")
    .update(prev + body, "utf8")
    .digest("hex");

export async function appendAudit(e: AuditInput): Promise<{ id: number; hash: string }> {
  const [row] = await getSql()<{ id: string; hash: string }[]>`
    select id, hash from append_audit(${auditBody(e)})`;
  return { id: Number(row!.id), hash: row!.hash };
}

export interface ChainRow {
  id: number;
  at: Date | string;
  actor: string | null;
  role: string;
  action: string;
  dag_id: number | null;
  detail: unknown;
  body: string;
  prev_hash: string;
  hash: string;
}

export interface ChainReport {
  ok: boolean;
  entries: number;
  /** First entry that does not fit the chain, and why. */
  broken_at?: number;
  reason?: "hash" | "link" | "fields";
  last_hash: string;
}

/** Check every link, every hash, and that each row's columns say what its hashed body says. */
export function verifyRows(rows: ChainRow[]): ChainReport {
  let prev = GENESIS;
  for (const r of rows) {
    if (r.prev_hash !== prev) return { ok: false, entries: rows.length, broken_at: r.id, reason: "link", last_hash: prev }; // prettier-ignore
    if (chainHash(r.prev_hash, r.body) !== r.hash) return { ok: false, entries: rows.length, broken_at: r.id, reason: "hash", last_hash: prev }; // prettier-ignore
    const b = JSON.parse(r.body) as Record<string, unknown>;
    const same =
      b.actor === r.actor &&
      b.role === r.role &&
      b.action === r.action &&
      b.dag_id === r.dag_id &&
      new Date(b.at as string).getTime() === new Date(r.at).getTime() &&
      JSON.stringify(sortKeys(b.detail)) === JSON.stringify(sortKeys(r.detail));
    if (!same) return { ok: false, entries: rows.length, broken_at: r.id, reason: "fields", last_hash: prev }; // prettier-ignore
    prev = r.hash;
  }
  return { ok: true, entries: rows.length, last_hash: prev };
}

/** jsonb stores keys in its own order; compare objects independent of key order. */
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/** Verify the whole chain as stored in the database (trusted server code). */
export async function verifyAuditChain(): Promise<ChainReport> {
  const rows = await getSql()<ChainRow[]>`
    select id::int, at, actor, role, action, dag_id, detail, body, prev_hash, hash
    from audit_log order by id`;
  return verifyRows(rows);
}

export const ACTION_BN: Record<string, string> = {
  view_report: "জমি যাচাই রিপোর্ট দেখেছেন",
  view_ledger: "শেয়ার লেজার দেখেছেন",
  view_map: "মৌজা ম্যাপে মাপ দেখেছেন",
  view_warish: "ওয়ারিশ হিসাব দেখেছেন",
  read_deed: "দলিল পড়েছেন",
  register_baina: "বায়না নিবন্ধনের চেষ্টা",
  register_sale: "বিক্রয় দলিল নিবন্ধনের চেষ্টা",
  register_lien: "বন্ধক নিবন্ধনের চেষ্টা",
  seal_issue: "সিলযুক্ত রিপোর্ট নিয়েছেন",
  seal_verify: "সিলযুক্ত রিপোর্ট যাচাই করেছেন",
  app_submit: "সেবার আবেদন করেছেন",
  app_pay: "আবেদনের ফি দিয়েছেন",
  app_decide: "আবেদনে সিদ্ধান্ত দিয়েছেন",
  doc_issue: "স্বাক্ষরিত ডকুমেন্ট ইস্যু করেছেন",
  doc_verify: "স্বাক্ষরিত ডকুমেন্ট যাচাই করেছেন",
  docs_settings: "/docs পাতার প্রকাশ বদলেছেন",
};

export const ACTION_EN: Record<string, string> = {
  view_report: "viewed the land check report",
  view_ledger: "viewed the share ledger",
  view_map: "measured it on the mouza map",
  view_warish: "viewed the inheritance shares",
  read_deed: "read a deed",
  register_baina: "tried to register a baina",
  register_sale: "tried to register a sale deed",
  register_lien: "tried to register a mortgage",
  seal_issue: "took a sealed report",
  seal_verify: "verified a sealed report",
  app_submit: "applied for a service",
  app_pay: "paid an application fee",
  app_decide: "decided an application",
  doc_issue: "issued a signed document",
  doc_verify: "verified a signed document",
  denied: "tried to register without permission (blocked)",
  unlock_account: "unlocked an account",
  docs_settings: "changed /docs publishing",
};

export const ROLE_LABEL_EN: Record<string, string> = {
  public: "A visitor (not signed in)",
  citizen: "A citizen",
  officer: "A sub-registry officer",
  admin: "An administrator",
};

export const ROLE_LABEL_BN: Record<string, string> = {
  public: "লগইন ছাড়া একজন দর্শক",
  citizen: "একজন নাগরিক",
  officer: "সাব-রেজিস্ট্রি কর্মকর্তা",
  admin: "প্রশাসক",
};

export interface LandViewEntry {
  id: number;
  at: string;
  role: string;
  role_bn: string;
  role_en: string;
  action: string;
  action_bn: string;
  action_en: string;
  mouza_bn: string;
  mouza_en: string;
  dag_no: number;
  detail: Record<string, unknown>;
}

/**
 * "Who checked my land": entries for the dags this account holds, read AS the user, so Row Level
 * Security decides (a citizen sees only their own dags; officers see all). Other people's
 * identities are never returned, only their role.
 */
export async function whoCheckedMyLand(user: SessionUser, limit = 50): Promise<LandViewEntry[]> {
  const rows = await withUser(
    user,
    (tx) => tx<Omit<LandViewEntry, "role_bn" | "role_en" | "action_bn" | "action_en">[]>`
      select a.id::int, to_char(a.at at time zone 'Asia/Dhaka', 'YYYY-MM-DD HH24:MI') as at,
             a.role, a.action, mz.name_bn as mouza_bn, mz.name_en as mouza_en, d.dag_no, a.detail
      from audit_log a
      join dags d on d.id = a.dag_id
      join mouzas mz on mz.id = d.mouza_id
      where a.dag_id in (select h.dag_id from bs_holdings h where h.owner_id = ${user.owner_id ?? -1})
      order by a.id desc limit ${limit}`,
  );
  return rows.map((r) => ({
    ...r,
    role_bn: ROLE_LABEL_BN[r.role] ?? r.role,
    role_en: ROLE_LABEL_EN[r.role] ?? r.role,
    action_bn: ACTION_BN[r.action] ?? r.action,
    action_en: ACTION_EN[r.action] ?? r.action,
  }));
}

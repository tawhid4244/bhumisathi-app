import { withUser } from "../auth/db";
import type { SessionUser } from "../auth/roles";
import { getSql } from "../sql";
import { ACTION_BN, ACTION_EN, ROLE_LABEL_BN, ROLE_LABEL_EN } from "./audit";

// Data for the office view (/admin): officers see the day's work and the audit trail;
// admins also see accounts. Identities in the audit log stay hidden (RLS column grants).

export interface OfficeSummary {
  dags: number;
  accepted: number;
  refused: number;
  pending_mutations: number;
  seals: number;
  audit_entries: number;
}

export async function officeSummary(): Promise<OfficeSummary> {
  const [r] = await getSql()<OfficeSummary[]>`
    select (select count(*) from dags)::int as dags,
           (select count(*) from ledger_events where status = 'accepted')::int as accepted,
           (select count(*) from ledger_events where status = 'rejected')::int as refused,
           (select count(*) from mutation_cases where status = 'pending')::int as pending_mutations,
           (select count(*) from audit_log where action = 'seal_issue')::int as seals,
           (select count(*) from audit_log)::int as audit_entries`;
  return r!;
}

export interface AuditListEntry {
  id: number;
  at: string;
  role_bn: string;
  role_en: string;
  action: string;
  action_bn: string;
  action_en: string;
  place_bn: string | null;
  place_en: string | null;
}

/** Latest audit entries, read AS the officer (RLS: officers see all rows, never who). */
export async function recentAudit(user: SessionUser, limit = 20): Promise<AuditListEntry[]> {
  const rows = await withUser(
    user,
    (tx) => tx<
      {
        id: number;
        at: string;
        role: string;
        action: string;
        mouza_bn: string | null;
        mouza_en: string | null;
        dag_no: number | null;
      }[]
    >`
      select a.id::int, to_char(a.at at time zone 'Asia/Dhaka', 'YYYY-MM-DD HH24:MI') as at,
             a.role, a.action, mz.name_bn as mouza_bn, mz.name_en as mouza_en, d.dag_no
      from audit_log a
      left join dags d on d.id = a.dag_id
      left join mouzas mz on mz.id = d.mouza_id
      order by a.id desc limit ${limit}`,
  );
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    role_bn: ROLE_LABEL_BN[r.role] ?? r.role,
    role_en: ROLE_LABEL_EN[r.role] ?? r.role,
    action: r.action,
    action_bn: ACTION_BN[r.action] ?? (r.action === "denied" ? "অনুমতি ছাড়া নিবন্ধনের চেষ্টা (আটকানো)" : r.action), // prettier-ignore
    action_en: ACTION_EN[r.action] ?? r.action,
    place_bn: r.mouza_bn ? `${r.mouza_bn}, দাগ ${r.dag_no}` : null,
    place_en: r.mouza_en ? `${r.mouza_en}, dag ${r.dag_no}` : null,
  }));
}

export interface AccountRow {
  email: string;
  name_bn: string;
  role: string;
  failed_logins: number;
  locked: boolean;
  linked_owner: boolean;
}

/** Admins only (the page checks the role before calling this). No password hashes, ever. */
export async function listAccounts(): Promise<AccountRow[]> {
  return getSql()<AccountRow[]>`
    select email, name_bn, role, failed_logins,
           coalesce(locked_until > now(), false) as locked, owner_id is not null as linked_owner
    from users order by case role when 'admin' then 0 when 'officer' then 1 else 2 end, email`;
}

/** Clear a lockout (admins). Returns false when no such account. */
export async function unlockAccount(email: string): Promise<boolean> {
  const rows = await getSql()`
    update users set failed_logins = 0, locked_until = null where email = ${email.toLowerCase()}
    returning id`;
  return rows.length > 0;
}

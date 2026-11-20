import { getSql } from "../sql";

// The /docs page (pitch deck + technical docs) can be switched off or limited to a time window
// by an admin. Admins can always see it, so they can check it before opening it to the public.

export interface DocsSettings {
  visible: boolean;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string | null;
}

const OPEN: DocsSettings = { visible: true, starts_at: null, ends_at: null, updated_at: null };

/** Is /docs open to the public at `now`? (Pure, so it is easy to test.) */
export function docsOpen(s: DocsSettings, now: Date = new Date()): boolean {
  if (!s.visible) return false;
  if (s.starts_at && now < new Date(s.starts_at)) return false;
  if (s.ends_at && now > new Date(s.ends_at)) return false;
  return true;
}

export async function getDocsSettings(): Promise<DocsSettings> {
  try {
    const [r] = await getSql()<DocsSettings[]>`
      select visible, starts_at::text, ends_at::text, updated_at::text from docs_settings where id = 1`;
    return r ?? OPEN;
  } catch {
    // shortcut: table missing (migration not yet run) → treat as open, upgrade once 0009 is everywhere
    return OPEN;
  }
}

/** Live numbers for /docs, straight from the database (the same counts the office view uses). */
export async function docsLive(): Promise<[string, number][]> {
  const [r] = await getSql()<Record<string, number>[]>`
    select (select count(*) from dags)::int as dags,
           (select count(*) from khatians)::int as khatians,
           (select count(*) from ledger_events where status = 'accepted')::int as accepted,
           (select count(*) from ledger_events where status = 'rejected')::int as blocked,
           (select count(*) from applications)::int as applications,
           (select count(*) from users)::int as accounts,
           (select count(*) from audit_log)::int as audit`;
  return [
    ["Plots (dags) in the ledger", r!.dags!],
    ["Khatians (CS/SA/RS/BS)", r!.khatians!],
    ["Registered transactions", r!.accepted!],
    ["Blocked transactions (double sale etc.)", r!.blocked!],
    ["Service applications", r!.applications!],
    ["Demo accounts", r!.accounts!],
    ["Audit log entries", r!.audit!],
  ];
}

/** Khatians per survey (CS → SA → RS → BS): one plot's record is split across all four. */
export async function khatiansBySurvey(): Promise<{ survey: string; khatians: number }[]> {
  return getSql()<{ survey: string; khatians: number }[]>`
    select survey, count(*)::int as khatians from khatians
    group by survey order by array_position(array['CS','SA','RS','BS'], survey)`;
}

/** RFC 4180 CSV: quote every field, double inner quotes. */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n"; // prettier-ignore
}

export async function setDocsSettings(s: {
  visible: boolean;
  starts_at: string | null;
  ends_at: string | null;
}): Promise<DocsSettings> {
  const [r] = await getSql()<DocsSettings[]>`
    insert into docs_settings (id, visible, starts_at, ends_at, updated_at)
    values (1, ${s.visible}, ${s.starts_at}, ${s.ends_at}, now())
    on conflict (id) do update set visible = excluded.visible, starts_at = excluded.starts_at,
      ends_at = excluded.ends_at, updated_at = now()
    returning visible, starts_at::text, ends_at::text, updated_at::text`;
  return r!;
}

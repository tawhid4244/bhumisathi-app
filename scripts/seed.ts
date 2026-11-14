// npm run seed → reset the database to the deterministic synthetic world (seed 2026).
// Runs migrations first, then wipes every app table and inserts the rows from seed-data.ts
// inside ONE transaction, so a failed seed leaves the old data untouched.
import type postgres from "postgres";
import { buildWorld, TABLE_ORDER } from "./seed-data";

/** Tables added by later tasks that must also be emptied on reset (if they exist). */
const EXTRA_TABLES = ["ledger_events", "sms_log", "mutation_cases", "audit_log"];

export async function seed(sql: postgres.Sql): Promise<Record<string, number>> {
  const world = buildWorld(2026);
  const counts: Record<string, number> = {};
  await sql.begin(async (tx) => {
    const existing = new Set(
      (
        await tx<
          { tablename: string }[]
        >`select tablename from pg_tables where schemaname = 'public'`
      ).map((r) => r.tablename),
    );
    const toWipe = [...EXTRA_TABLES.filter((t) => existing.has(t)), ...[...TABLE_ORDER].reverse()];
    await tx.unsafe(`truncate ${toWipe.join(", ")} restart identity cascade`);

    for (const table of TABLE_ORDER) {
      const rows = world[table];
      // Insert in chunks to keep each statement small.
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map((r) =>
          // jsonb columns need explicit JSON
          "points" in r ? { ...r, points: tx.json(r.points as postgres.JSONValue) } : r,
        );
        await tx`insert into ${tx(table)} ${tx(chunk as Record<string, postgres.ParameterOrJSON<never>>[])}`;
      }
      counts[table] = rows.length;
    }

    // Later tasks register hooks here (e.g. resetting the baina number sequence).
    const hook = await tx`select 1 from pg_proc where proname = 'after_seed'`;
    if (hook.length > 0) await tx`select after_seed()`;
  });
  return counts;
}

// Applies supabase/migrations/*.sql in name order, each once, each in its own transaction.
// Works against the local database and against Supabase cloud (via DATABASE_URL).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type postgres from "postgres";

const dir = path.join(process.cwd(), "supabase", "migrations");

export async function migrate(sql: postgres.Sql, log = false): Promise<string[]> {
  await sql`create table if not exists public._migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;
  const done = new Set(
    (await sql<{ name: string }[]>`select name from public._migrations`).map((r) => r.name),
  );
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const body = readFileSync(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into public._migrations (name) values (${file})`;
    });
    applied.push(file);
    if (log) console.log(`applied ${file}`);
  }
  return applied;
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  (async () => {
    const { ensureLocalDb } = await import("./local-db");
    const { getSql, closeSql } = await import("../lib/sql");
    if (!process.env.DATABASE_URL) await ensureLocalDb();
    const applied = await migrate(getSql(), true);
    if (applied.length === 0) console.log("Database is up to date.");
    await closeSql();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

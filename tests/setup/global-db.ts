// Vitest global setup: make sure a database is running and migrated before integration tests.
// Locally (no DATABASE_URL) it starts the embedded PostgreSQL; in CI or against Supabase it
// uses DATABASE_URL as given.
import { ensureLocalDb } from "../../scripts/local-db";
import { migrate } from "../../scripts/migrate";
import { closeSql, getSql } from "../../lib/sql";

export default async function setup() {
  if (!process.env.DATABASE_URL) await ensureLocalDb();
  await migrate(getSql());
  await closeSql();
}

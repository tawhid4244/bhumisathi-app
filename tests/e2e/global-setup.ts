// Playwright global setup: database running, migrated and seeded before any browser test.
import { closeSql, getSql } from "../../lib/sql";
import { ensureLocalDb } from "../../scripts/local-db";
import { migrate } from "../../scripts/migrate";
import { ensureDemoUsers } from "../../scripts/demo-users";
import { seed } from "../../scripts/seed";

export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return; // a deployed site has its own database
  if (!process.env.DATABASE_URL) await ensureLocalDb();
  const sql = getSql();
  await migrate(sql);
  await seed(sql);
  await ensureDemoUsers(sql); // the accounts the e2e setup project logs in with
  await closeSql();
}

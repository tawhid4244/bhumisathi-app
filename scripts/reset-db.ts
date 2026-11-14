// npm run db:reset → LOCAL ONLY: drop every table and re-run all migrations from scratch.
// Refuses to run when DATABASE_URL is set, so it can never wipe a cloud database by mistake.
import { ensureLocalDb } from "./local-db";
import { migrate } from "./migrate";
import { closeSql, getSql } from "../lib/sql";

async function main() {
  if (process.env.DATABASE_URL) {
    throw new Error("db:reset only works on the local database (unset DATABASE_URL).");
  }
  await ensureLocalDb();
  const sql = getSql();
  await sql.unsafe("drop schema public cascade; create schema public;");
  await migrate(sql, true);
  await closeSql();
}
main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});

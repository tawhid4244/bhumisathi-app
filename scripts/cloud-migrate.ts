// npm run cloud:migrate → apply new migrations to the cloud database ONLY (no seed, no accounts).
// Use it before deploying code that needs a new table. Uses CLOUD_DATABASE_URL from .env.local.
// Prints no secrets.
import { closeSql, getSql } from "../lib/sql";
import { migrate } from "./migrate";

async function main() {
  const url = process.env.CLOUD_DATABASE_URL;
  if (!url) {
    console.error("CLOUD_DATABASE_URL is not set. Run  npm.cmd run set-db  first.");
    process.exit(1);
  }
  process.env.DATABASE_URL = url; // every query in this run goes to the cloud
  const applied = await migrate(getSql(), true);
  console.log(applied.length ? `✓ Applied ${applied.length} migration(s) on ${new URL(url).hostname}` : "✓ Cloud database is up to date."); // prettier-ignore
  await closeSql();
}

main().catch(async (err) => {
  console.error(String(err).replace(/postgres(ql)?:\/\/[^\s]+/g, "postgresql://***"));
  await closeSql();
  process.exit(1);
});

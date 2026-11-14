// npm run cloud:setup → prepare the cloud database: apply migrations, load the synthetic world,
// create the demo accounts, and cache the law embeddings (if an AI key is set).
// Uses CLOUD_DATABASE_URL from .env.local. Prints no secrets.
import { closeSql, getSql } from "../lib/sql";
import { ensureAuthSecrets, ensureDemoUsers } from "./demo-users";
import { migrate } from "./migrate";
import { seed } from "./seed";

async function main() {
  const url = process.env.CLOUD_DATABASE_URL;
  if (!url) {
    console.error("CLOUD_DATABASE_URL is not set. Run  npm.cmd run set-db  first.");
    process.exit(1);
  }
  process.env.DATABASE_URL = url; // every query in this run goes to the cloud
  ensureAuthSecrets();
  const sql = getSql();
  const [{ version }] = await sql<{ version: string }[]>`select split_part(version(), ' ', 2) as version`; // prettier-ignore
  console.log(`✓ Connected to ${new URL(url).hostname} (PostgreSQL ${version})`);
  await migrate(sql, true);
  const counts = await seed(sql);
  console.log(`✓ Synthetic world loaded: ${counts.dags} dags, ${counts.owners} owners`);
  const made = await ensureDemoUsers(sql, true);
  console.log(`✓ Demo accounts ready (${made}); password = DEMO_USER_PASSWORD in .env.local`);
  try {
    const { embedLibrary } = await import("./embed");
    const r = await embedLibrary(sql);
    console.log(`✓ Law embeddings cached (${r.embedded} new of ${r.total})`);
  } catch (err) {
    console.log(`• Embeddings skipped (${(err as Error).message.slice(0, 80)}); keyword search still works.`); // prettier-ignore
  }
  await closeSql();
  console.log('Next: tell Claude "cloud ready".');
}

main().catch(async (err) => {
  console.error(String(err).replace(/postgres(ql)?:\/\/[^\s]+/g, "postgresql://***"));
  await closeSql();
  process.exit(1);
});

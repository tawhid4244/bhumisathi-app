// npm run seed → migrate, then reset the database to the deterministic synthetic world.
// Kept apart from seed.ts so the web app (demo reset) never bundles the local Postgres tooling.
(async () => {
  const { ensureLocalDb } = await import("./local-db");
  const { seed } = await import("./seed");
  const { migrate } = await import("./migrate");
  const { getSql, closeSql } = await import("../lib/sql");
  if (!process.env.DATABASE_URL) await ensureLocalDb();
  const sql = getSql();
  await migrate(sql, true);
  const counts = await seed(sql);
  console.log("Seeded synthetic world (seed 2026). Rows per table:");
  console.table(counts);
  await closeSql();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

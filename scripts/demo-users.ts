// npm run users → make sure the auth secrets exist in .env.local and the demo accounts exist.
//
// * AUTH_SECRET (signs short-lived upload links) and DEMO_USER_PASSWORD are generated with a
//   secure random generator the first time and written to .env.local (git-ignored). They are
//   never printed. To see the demo password, open .env.local yourself.
// * One synthetic account per role. Emails use the reserved .test domain, so they can never
//   belong to a real person. Demo reset does NOT touch accounts.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type postgres from "postgres";
import { hashPassword } from "../lib/auth/password";
import { DEMO_USERS } from "../lib/auth/demo-accounts";
import { upsertEnv } from "../lib/env-file";

export { DEMO_USERS };

/** Generate missing secrets into .env.local and process.env. Returns the names it created. */
export function ensureAuthSecrets(envPath = path.join(process.cwd(), ".env.local")): string[] {
  const created: Record<string, string> = {};
  if (!process.env.AUTH_SECRET) created.AUTH_SECRET = randomBytes(32).toString("base64url");
  if (!process.env.DEMO_USER_PASSWORD) {
    created.DEMO_USER_PASSWORD = `Demo-${randomBytes(12).toString("base64url")}`;
  }
  if (Object.keys(created).length > 0) {
    const text = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
    writeFileSync(envPath, upsertEnv(text, created), "utf8");
    Object.assign(process.env, created);
  }
  return Object.keys(created);
}

/**
 * Create the demo accounts that do not exist yet (or all of them with force, e.g. after the
 * password changed). Hashing is deliberately slow, so existing accounts are skipped by default.
 */
export async function ensureDemoUsers(sql: postgres.Sql, force = false): Promise<number> {
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password) return 0;
  const existing = new Set(
    (await sql<{ email: string }[]>`select email from users`).map((r) => r.email),
  );
  let made = 0;
  for (const u of DEMO_USERS) {
    if (!force && existing.has(u.email)) continue;
    const hash = await hashPassword(password);
    await sql`
      insert into users (email, name_bn, role, password_hash)
      values (${u.email}, ${u.name_bn}, ${u.role}, ${hash})
      on conflict (email) do update set name_bn = excluded.name_bn, role = excluded.role,
        password_hash = excluded.password_hash, failed_logins = 0, locked_until = null`;
    made++;
  }
  return made;
}

if (process.argv[1]?.endsWith("demo-users.ts")) {
  (async () => {
    const { ensureLocalDb } = await import("./local-db");
    const { migrate } = await import("./migrate");
    const { getSql, closeSql } = await import("../lib/sql");
    const created = ensureAuthSecrets();
    if (created.length)
      console.log(`✓ Generated ${created.join(" and ")} in .env.local (not shown).`);
    if (!process.env.DATABASE_URL) await ensureLocalDb();
    const sql = getSql();
    await migrate(sql, true);
    const n = await ensureDemoUsers(sql, process.argv.includes("--force"));
    console.log(`✓ Demo accounts ready (${n} created or updated):`);
    for (const u of DEMO_USERS) console.log(`   ${u.role.padEnd(8)} ${u.email}`);
    console.log("  Password: DEMO_USER_PASSWORD in .env.local");
    await closeSql();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

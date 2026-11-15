import postgres from "postgres";
import { LOCAL_DATABASE_URL } from "./local-db-config";

// Server-side SQL connection (postgres.js). Used by engines, API routes, scripts and tests.
// DATABASE_URL points at Supabase cloud in production; locally it defaults to the
// embedded PostgreSQL started by `npm run db:start`.

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set.");
  }
  return LOCAL_DATABASE_URL;
}

type Sql = ReturnType<typeof postgres>;

// Reuse one pool per process (Next.js dev hot-reload would otherwise open new pools).
const globalForSql = globalThis as unknown as { __bhumiSql?: Sql; __bhumiSqlUsed?: number };

/**
 * On Vercel a function instance is frozen between requests; while frozen, the cloud pooler drops
 * its idle connections, and timers (idle_timeout) do not run. A query sent on such a dead socket
 * fails or waits forever. Two guards:
 *  - idle connections are closed after 2 s (normally long before the instance is frozen);
 *  - if the pool has not been used for a while, it is replaced by a fresh one before anything is
 *    sent. performance.now() is used (Date.now() is not allowed while Next.js prerenders).
 */
const STALE_AFTER_MS = 10_000;
const clock = () => performance.now();

export function getSql(): Sql {
  if (typeof window !== "undefined") throw new Error("getSql() is server-only.");
  const now = clock();
  const last = globalForSql.__bhumiSqlUsed ?? now;
  if (globalForSql.__bhumiSql && process.env.VERCEL && now - last > STALE_AFTER_MS) {
    const old = globalForSql.__bhumiSql;
    globalForSql.__bhumiSql = undefined;
    void old.end({ timeout: 5 }).catch(() => {});
  }
  globalForSql.__bhumiSqlUsed = now;
  if (!globalForSql.__bhumiSql) {
    const url = databaseUrl();
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    globalForSql.__bhumiSql = postgres(url, {
      max: local ? 10 : 5,
      // Serverless (see above): close idle connections quickly, cap their lifetime, and give up on
      // a connect that does not answer in 10 s. A new connection to the pooler costs ~10 ms.
      idle_timeout: local ? undefined : 2,
      max_lifetime: local ? undefined : 60 * 5,
      connect_timeout: 10,
      // numeric columns come back as strings by default; areas are converted explicitly.
      onnotice: () => {},
      prepare: false, // required by Supabase's transaction pooler; harmless locally
      ssl: local ? false : "require", // the cloud database is only ever reached over TLS
    });
  }
  return globalForSql.__bhumiSql;
}

export async function closeSql(): Promise<void> {
  if (globalForSql.__bhumiSql) {
    await globalForSql.__bhumiSql.end({ timeout: 5 });
    globalForSql.__bhumiSql = undefined;
  }
}

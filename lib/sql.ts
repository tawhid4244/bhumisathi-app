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
const globalForSql = globalThis as unknown as { __bhumiSql?: Sql };

export function getSql(): Sql {
  if (typeof window !== "undefined") throw new Error("getSql() is server-only.");
  if (!globalForSql.__bhumiSql) {
    const url = databaseUrl();
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    globalForSql.__bhumiSql = postgres(url, {
      max: 10,
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

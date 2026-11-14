import { getSql } from "../sql";

// Fixed-window rate limit stored in Postgres, so it holds across every server instance.
// consume("agent:<user>", 15, 60) → allowed while the count in this minute is ≤ 15.

export async function consume(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  const sql = getSql();
  const [row] = await sql<{ count: number; retry: number }[]>`
    with w as (
      select to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}) as start
    )
    insert into rate_limits (key, window_start, count)
    select ${key}, start, 1 from w
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count, ceil(${windowSeconds} - extract(epoch from now() - window_start))::int as retry`;
  return { ok: row!.count <= limit, retryAfter: Math.max(1, row!.retry) };
}

/** Delete windows older than two days (called from the demo reset and the seed). */
export async function pruneRateLimits(): Promise<void> {
  await getSql()`delete from rate_limits where window_start < now() - interval '2 days'`;
}

export const LIMITS = {
  agent: { perMinute: 15, perDay: 300 },
  upload: { perMinute: 10 },
  // Per IP. The e2e test server raises it (many test logins come from one machine).
  login: { perMinute: Number(process.env.LOGIN_RATE_PER_MINUTE) || 10 },
} as const;

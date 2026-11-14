import { connection } from "next/server";
import { getSql } from "@/lib/sql";
import { sealKeys } from "@/lib/engines/seal";

// GET /api/health → is the site configured and can it reach its database?
// Reports only yes/no per setting and an error CODE (never a value, never a message that could
// contain a secret), so it is safe to leave public.
const NAMES = ["DATABASE_URL", "AUTH_SECRET", "SEAL_PRIVATE_KEY", "AI_PROVIDER", "AI_API_KEY", "SITE_URL"]; // prettier-ignore

export async function GET() {
  await connection();
  const env = Object.fromEntries(NAMES.map((n) => [n, Boolean(process.env[n])]));
  let database: { ok: boolean; code?: string } = { ok: false };
  try {
    await getSql()`select 1`;
    database = { ok: true };
  } catch (err) {
    database = { ok: false, code: String((err as { code?: string }).code ?? (err as Error).name) };
  }
  let seal = false;
  try {
    sealKeys();
    seal = true;
  } catch {
    seal = false;
  }
  const ok = database.ok && seal && Object.values(env).every(Boolean);
  return Response.json(
    { ok, env, database, seal_key: seal, region: process.env.VERCEL_REGION ?? null },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}

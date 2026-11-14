import { redirect } from "next/navigation";
import { consume } from "../security/rate-limit";
import { currentUser } from "./current";
import { allowed, type Access, type SessionUser } from "./roles";

// Small helpers so every route checks access the same way.

const json = (status: number, bn: string, en: string, headers?: HeadersInit) =>
  Response.json({ error: { bn, en } }, { status, headers });

export const UNAUTHORIZED = () => json(401, "এই সেবার জন্য আগে লগইন করুন।", "Please sign in first.");
export const FORBIDDEN = () =>
  json(403, "আপনার এই কাজের অনুমতি নেই।", "Your role is not allowed to do this.");

/** Route handlers: the signed-in user with at least `need`, or the 401/403 response to return. */
export async function requireRole(
  need: Exclude<Access, "public">,
): Promise<{ user: SessionUser; deny?: undefined } | { user?: undefined; deny: Response }> {
  const user = await currentUser();
  if (!user) return { deny: UNAUTHORIZED() };
  if (!allowed(user, need)) return { deny: FORBIDDEN() };
  return { user };
}

/** Pages: send signed-out visitors to /login and come back afterwards. */
export async function requirePageRole(need: Exclude<Access, "public">, back: string) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  return { user, ok: allowed(user, need) };
}

/** Count one request against a limit; returns a 429 response when it is used up. */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const r = await consume(key, limit, windowSeconds);
  if (r.ok) return null;
  return json(
    429,
    "অনেক বেশি অনুরোধ এসেছে। একটু পরে আবার চেষ্টা করুন।",
    "Too many requests. Try again later.",
    { "retry-after": String(r.retryAfter) },
  );
}

/** Client IP for rate limiting: the first X-Forwarded-For hop (set by the hosting proxy). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || request.headers.get("x-real-ip") || "local").slice(0, 64);
}

/** Only allow redirects back to our own pages ("/chat"), never "//evil.example" or "https://…". */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\") || /[\r\n]/.test(next)) return fallback;
  return next.slice(0, 200);
}

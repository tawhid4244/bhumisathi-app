import { cookies } from "next/headers";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/auth/guard";
import { login, SESSION_COOKIE, SESSION_HOURS } from "@/lib/auth/session";
import { LIMITS } from "@/lib/security/rate-limit";

// POST /api/auth/login {email, password} → sets the session cookie.
// One message for "no such account" and "wrong password", so emails cannot be discovered.
// Limits: 10 tries a minute per IP, and the account locks for 15 minutes after 5 wrong passwords.

const body = z.object({
  email: z.string().trim().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const limited = await rateLimit(`login:${clientIp(request)}`, LIMITS.login.perMinute, 60);
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { bn: "ইমেইল ও পাসওয়ার্ড দিন।", en: "Email and password required." } }, { status: 400 }); // prettier-ignore
  }
  const r = await login(parsed.data.email, parsed.data.password);
  if (!r.ok) {
    const error =
      r.reason === "locked"
        ? { bn: "অনেকবার ভুল পাসওয়ার্ড। ১৫ মিনিট পরে আবার চেষ্টা করুন।", en: "Account locked for 15 minutes." } // prettier-ignore
        : { bn: "ইমেইল বা পাসওয়ার্ড সঠিক নয়।", en: "Wrong email or password." };
    return Response.json({ error }, { status: r.reason === "locked" ? 423 : 401 });
  }
  (await cookies()).set(SESSION_COOKIE, r.token, {
    httpOnly: true, // JavaScript in the page can never read it
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // not sent on cross-site POSTs
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return Response.json({ user: r.user });
}

import { cookies } from "next/headers";
import { logout, SESSION_COOKIE } from "@/lib/auth/session";

// POST /api/auth/logout → deletes the session on the server (not only the cookie).
export async function POST() {
  const jar = await cookies();
  await logout(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}

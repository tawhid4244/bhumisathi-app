import { cookies } from "next/headers";
import type { SessionUser } from "./roles";
import { SESSION_COOKIE, userFromToken } from "./session";

/** The signed-in user for this request (server components and route handlers), or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

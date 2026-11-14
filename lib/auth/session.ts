import { createHash, randomBytes } from "node:crypto";
import { getSql } from "../sql";
import { dummyHash, verifyPassword } from "./password";
import type { Role, SessionUser } from "./roles";

// Server-side sessions. The cookie holds a random 256-bit token; the database holds only its
// SHA-256 hash. Sessions expire; logout deletes them; repeated wrong passwords lock the account.

export const SESSION_HOURS = 8;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export { SESSION_COOKIE } from "./session-cookie";

export type LoginResult =
  { ok: true; token: string; user: SessionUser } | { ok: false; reason: "invalid" | "locked" };

type UserRow = SessionUser & { password_hash: string; failed_logins: number; locked: boolean };

export async function login(emailRaw: string, password: string): Promise<LoginResult> {
  const sql = getSql();
  const email = emailRaw.trim().toLowerCase();
  const [u] = await sql<UserRow[]>`
    select id, email, name_bn, role, password_hash, failed_logins,
           coalesce(locked_until > now(), false) as locked
    from users where email = ${email}`;
  if (!u) {
    await verifyPassword(password, await dummyHash()); // same timing as a real check
    return { ok: false, reason: "invalid" };
  }
  if (u.locked) return { ok: false, reason: "locked" };
  if (!(await verifyPassword(password, u.password_hash))) {
    await sql`
      update users set failed_logins = failed_logins + 1,
        locked_until = case when failed_logins + 1 >= ${MAX_FAILED_LOGINS}
                            then now() + make_interval(mins => ${LOCK_MINUTES}) end
      where id = ${u.id}`;
    return { ok: false, reason: u.failed_logins + 1 >= MAX_FAILED_LOGINS ? "locked" : "invalid" };
  }
  await sql`update users set failed_logins = 0, locked_until = null where id = ${u.id}`;
  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${sha256(token)}, ${u.id}, now() + make_interval(hours => ${SESSION_HOURS}))`;
  return { ok: true, token, user: { id: u.id, email: u.email, name_bn: u.name_bn, role: u.role } };
}

export async function userFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const sql = getSql();
  const [u] = await sql<SessionUser[]>`
    select u.id, u.email, u.name_bn, u.role
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()`;
  return u ?? null;
}

export async function logout(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await getSql()`delete from sessions where token_hash = ${sha256(token)}`;
}

/** Create or update an account (used by the demo-user setup and tests). */
export async function upsertUser(args: {
  email: string;
  name_bn: string;
  role: Role;
  passwordHash: string;
}): Promise<string> {
  const [u] = await getSql()<{ id: string }[]>`
    insert into users (email, name_bn, role, password_hash)
    values (${args.email.toLowerCase()}, ${args.name_bn}, ${args.role}, ${args.passwordHash})
    on conflict (email) do update set name_bn = excluded.name_bn, role = excluded.role,
      password_hash = excluded.password_hash, failed_logins = 0, locked_until = null
    returning id`;
  return u!.id;
}

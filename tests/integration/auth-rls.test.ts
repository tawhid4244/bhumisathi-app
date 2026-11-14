import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UploadError } from "@/lib/adapters/storage";
import { assertCanReadUpload, storeUpload } from "@/lib/adapters/uploads";
import { withUser } from "@/lib/auth/db";
import { hashPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/roles";
import { login, logout, MAX_FAILED_LOGINS, upsertUser, userFromToken } from "@/lib/auth/session";
import { consume } from "@/lib/security/rate-limit";
import { closeSql, getSql } from "@/lib/sql";
import { runTool } from "@/lib/tools/registry";
import { seed } from "@/scripts/seed";

// Task 16: identity, roles and Row Level Security against the real database.

const sql = getSql();
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex"); // prettier-ignore
const NO_LOGIN = "scrypt$1$1$1$x$y"; // these accounts never log in

let alice: SessionUser; // citizen
let bob: SessionUser; // another citizen
let officer: SessionUser;

async function account(email: string, role: SessionUser["role"]): Promise<SessionUser> {
  const id = await upsertUser({ email, name_bn: email, role, passwordHash: NO_LOGIN });
  return { id, email, name_bn: email, role };
}

beforeAll(async () => {
  await seed(sql);
  alice = await account("alice@rls.test", "citizen");
  bob = await account("bob@rls.test", "citizen");
  officer = await account("officer@rls.test", "officer");
});

afterAll(async () => {
  await sql`delete from users where email like '%@rls.test' or email like '%@login.test'`;
  await closeSql();
});

describe("private uploads: a citizen cannot read another citizen's deed", () => {
  let id: string;
  beforeAll(async () => {
    id = (await storeUpload(alice, PNG)).id;
  });

  it("the owner and officers can read it; another citizen and visitors cannot", async () => {
    await expect(assertCanReadUpload(alice, id)).resolves.toBeUndefined();
    await expect(assertCanReadUpload(officer, id)).resolves.toBeUndefined();
    await expect(assertCanReadUpload(bob, id)).rejects.toBeInstanceOf(UploadError);
    await expect(assertCanReadUpload(null, id)).rejects.toBeInstanceOf(UploadError);
  });

  it("deed_read refuses Bob before any model sees Alice's deed", async () => {
    await expect(runTool("deed_read", { upload_id: id }, { user: bob })).rejects.toThrow(
      /not found/i,
    );
    await expect(runTool("deed_read", { upload_id: id }, { user: null })).rejects.toMatchObject({ name: "AccessDeniedError" }); // prettier-ignore
  });

  it("RLS hides the row itself, so even a raw query by Bob returns nothing", async () => {
    const rows = await withUser(bob, (tx) => tx`select id from uploads`);
    expect(rows.map((r) => r.id)).not.toContain(id);
    const own = await withUser(alice, (tx) => tx`select id from uploads`);
    expect(own.map((r) => r.id)).toContain(id);
  });

  it("nobody can create an upload row in someone else's name", async () => {
    await expect(
      withUser(bob, (tx) => tx`insert into uploads (id, owner_user_id, mime, size_bytes) values (${"c".repeat(24)}, ${alice.id}, 'image/png', 1)`), // prettier-ignore
    ).rejects.toThrow(/row-level security/);
  });
});

describe("the restricted database role", () => {
  it("can read land records but never NID or phone numbers, accounts or sessions", async () => {
    const dags = await withUser(alice, (tx) => tx`select count(*)::int as n from dags`);
    expect(dags[0]!.n).toBeGreaterThan(0);
    await expect(withUser(alice, (tx) => tx`select nid from owners limit 1`)).rejects.toThrow(/permission denied/); // prettier-ignore
    await expect(withUser(officer, (tx) => tx`select phone from owners limit 1`)).rejects.toThrow(/permission denied/); // prettier-ignore
    await expect(withUser(officer, (tx) => tx`select * from users`)).rejects.toThrow(/permission denied/); // prettier-ignore
    await expect(withUser(officer, (tx) => tx`select * from sessions`)).rejects.toThrow(/permission denied/); // prettier-ignore
  });

  it("shows ledger activity to officers only", async () => {
    await sql`insert into ledger_events (event_type, status, dag_id, owner_id, counterparty_id, area_dec)
              select 'baina', 'rejected', dag_id, owner_id, owner_id, 1 from ownership_shares limit 1`;
    const forCitizen = await withUser(
      alice,
      (tx) => tx`select count(*)::int as n from ledger_events`,
    );
    expect(forCitizen[0]!.n).toBe(0);
    const total = await sql`select count(*)::int as n from ledger_events`;
    const forOfficer = await withUser(
      officer,
      (tx) => tx`select count(*)::int as n from ledger_events`,
    );
    expect(forOfficer[0]!.n).toBe(total[0]!.n);
  });

  it("cannot call the ledger-write or audit functions (only the server's own role can)", async () => {
    await expect(withUser(officer, (tx) => tx`select register_event('sale', 1, 1, 4, 1)`)).rejects.toThrow(/permission denied/); // prettier-ignore
    await expect(withUser(officer, (tx) => tx`select * from append_audit('{}')`)).rejects.toThrow(/permission denied/); // prettier-ignore
  });

  it("stores the image bytes in the row, behind the same RLS", async () => {
    const id = (await storeUpload(alice, PNG)).id;
    const own = await withUser(alice, (tx) => tx`select length(data) as n from uploads where id = ${id}`); // prettier-ignore
    expect(Number(own[0]!.n)).toBe(PNG.length);
    const other = await withUser(bob, (tx) => tx`select data from uploads where id = ${id}`);
    expect(other).toHaveLength(0);
  });

  it("every table has Row Level Security switched on", async () => {
    const off =
      await sql`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`;
    expect(off.map((r) => r.tablename)).toEqual([]);
  });
});

describe("login, sessions and lockout", () => {
  const email = "lock@login.test";
  const password = "a-long-test-password-2026";

  beforeAll(async () => {
    await upsertUser({
      email,
      name_bn: "লক",
      role: "citizen",
      passwordHash: await hashPassword(password),
    });
  });

  it("logs in, finds the user from the cookie token, and logout ends the session", async () => {
    const r = await login(" LOCK@login.test ", password);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await userFromToken(r.token))?.email).toBe(email);
    const stored = await sql`select token_hash from sessions where user_id = ${r.user.id}`;
    expect(stored.map((s) => s.token_hash)).not.toContain(r.token); // only the hash is stored
    await logout(r.token);
    expect(await userFromToken(r.token)).toBeNull();
    expect(await userFromToken("forged-token-forged-token")).toBeNull();
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    expect(await login("nobody@login.test", password)).toEqual({ ok: false, reason: "invalid" });
    expect(await login(email, "wrong-password-123")).toEqual({ ok: false, reason: "invalid" });
  });

  it(`locks the account after ${MAX_FAILED_LOGINS} wrong passwords, even for the right one`, async () => {
    await sql`update users set failed_logins = 0, locked_until = null where email = ${email}`;
    const results = [];
    for (let i = 0; i < MAX_FAILED_LOGINS; i++)
      results.push((await login(email, "nope-nope-nope")).ok);
    expect(results.every((ok) => !ok)).toBe(true);
    expect(await login(email, password)).toEqual({ ok: false, reason: "locked" });
  });
});

describe("rate limits", () => {
  it("allows up to the limit in a window, then refuses with a retry time", async () => {
    const key = `test:${Date.now()}`;
    expect((await consume(key, 2, 60)).ok).toBe(true);
    expect((await consume(key, 2, 60)).ok).toBe(true);
    const third = await consume(key, 2, 60);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
    expect(third.retryAfter).toBeLessThanOrEqual(60);
  });
});

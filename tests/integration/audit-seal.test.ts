import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { withUser } from "@/lib/auth/db";
import type { SessionUser } from "@/lib/auth/roles";
import { upsertUser } from "@/lib/auth/session";
import { verifyAuditChain, whoCheckedMyLand } from "@/lib/engines/audit";
import { registerEvent } from "@/lib/engines/ledger";
import { parseCode, SEAL_PREFIX, verifySeal } from "@/lib/engines/seal";
import { closeSql, getSql } from "@/lib/sql";
import { runTool, SYSTEM } from "@/lib/tools/registry";
import { seed } from "@/scripts/seed";
import { OWNER } from "@/scripts/seed-data";

// Task 17: hash-chained audit log + BhumiSeal-lite (G7) against the real database.

process.env.SEAL_PRIVATE_KEY ??= generateKeyPairSync("ed25519")
  .privateKey.export({ format: "der", type: "pkcs8" })
  .toString("base64");

const sql = getSql();
const ANWAR = 20; // holder of dag 141 in the seed
const NO_LOGIN = "scrypt$1$1$1$x$y";
let anwar: SessionUser; // citizen linked to dag 141
let other: SessionUser; // citizen with no land
let officer: SessionUser;

async function account(email: string, role: SessionUser["role"], owner_id: number | null) {
  const id = await upsertUser({ email, name_bn: email, role, passwordHash: NO_LOGIN });
  await sql`update users set owner_id = ${owner_id} where id = ${id}`;
  return { id, email, name_bn: email, role, owner_id };
}

beforeEach(async () => {
  await seed(sql); // also empties the audit log
  anwar ??= await account("anwar@audit.test", "citizen", ANWAR);
  other ??= await account("other@audit.test", "citizen", null);
  officer ??= await account("officer@audit.test", "officer", null);
});

afterAll(async () => {
  await sql`delete from users where email like '%@audit.test'`;
  await closeSql();
});

const dag141 = { mouza: "Nayapara", dag_no: 141 };

describe("hash-chained audit log", () => {
  it("records every view and write made by a request, and the chain verifies", async () => {
    await runTool("jomi_check", dag141, { user: null });
    await runTool("ledger_status", dag141, { user: anwar });
    await runTool("register_baina", { ...dag141, seller_id: ANWAR, buyer_id: OWNER.SALMA, area_dec: 1 }, { user: officer }); // prettier-ignore
    await runTool("jomi_check", dag141, SYSTEM); // trusted scripts are not logged
    const rows = await sql`select action, role, detail from audit_log order by id`;
    expect(rows.map((r) => r.action)).toEqual(["view_report", "view_ledger", "register_baina"]);
    expect(rows.map((r) => r.role)).toEqual(["public", "citizen", "officer"]);
    expect(rows[2]!.detail).toMatchObject({ ok: true, area_dec: 1 });
    expect(await verifyAuditChain()).toMatchObject({ ok: true, entries: 3 });
  });

  it("logs a refused write attempt by a citizen", async () => {
    await expect(runTool("register_sale", { ...dag141, seller_id: ANWAR, buyer_id: 4, area_dec: 1 }, { user: anwar })).rejects.toThrow(/Access denied/); // prettier-ignore
    const [row] = await sql`select action, detail from audit_log`;
    expect(row).toMatchObject({ action: "denied", detail: { tool: "register_sale" } });
  });

  describe("tampering breaks the chain", () => {
    beforeEach(async () => {
      for (let i = 0; i < 4; i++) await runTool("jomi_check", dag141, { user: null });
    });
    const second = async () => Number((await sql`select id from audit_log order by id offset 1 limit 1`)[0]!.id); // prettier-ignore

    it("editing a column (who / what) is caught", async () => {
      const id = await second();
      await sql`update audit_log set role = 'officer' where id = ${id}`;
      expect(await verifyAuditChain()).toMatchObject({
        ok: false,
        broken_at: id,
        reason: "fields",
      });
    });

    it("editing the hashed text is caught", async () => {
      const id = await second();
      await sql`update audit_log set body = replace(body, 'view_report', 'view_map'), action = 'view_map' where id = ${id}`; // prettier-ignore
      expect(await verifyAuditChain()).toMatchObject({ ok: false, broken_at: id, reason: "hash" });
    });

    it("deleting an entry is caught at the next one", async () => {
      const id = await second();
      await sql`delete from audit_log where id = ${id}`;
      const r = await verifyAuditChain();
      expect(r).toMatchObject({ ok: false, reason: "link" });
      expect(r.broken_at).toBeGreaterThan(id);
    });
  });
});

describe("G7: BhumiSeal-lite on dag 141", () => {
  const issue = async () =>
    (await runTool("seal_issue", dag141, { user: anwar })) as {
      code: string;
      verify_url: string;
      qr_svg: string;
      payload: { ledger_version: number; holders: unknown[]; dag_no: number };
    };
  const check = (code: string) =>
    runTool("seal_verify", { code }, { user: null }) as ReturnType<typeof verifySeal>;

  it("the QR holds the fields, the Ed25519 signature and the ledger version", async () => {
    const s = await issue();
    expect(s.code.startsWith(`${SEAL_PREFIX}.`)).toBe(true);
    expect(s.verify_url).toMatch(/\/verify#BS1\./);
    expect(s.qr_svg).toContain("<svg");
    const parsed = parseCode(s.code)!;
    expect(parsed.sig).toHaveLength(64); // Ed25519
    expect(parsed.payload).toMatchObject({ dag_no: 141, mouza_en: "Nayapara", verdict: "green", ledger_version: 0 }); // prettier-ignore
    expect(parseCode(s.verify_url)?.payload.dag_no).toBe(141); // the full link works too
  });

  it("verify genuine → GENUINE + CURRENT, all four lights green", async () => {
    const r = await check((await issue()).code);
    expect(r.overall).toBe("green");
    expect(r.overall_en).toBe("GENUINE + CURRENT");
    expect(Object.values(r.lights).every((l) => l.ok)).toBe(true);
  });

  it("edit one digit in the payload → NOT GENUINE", async () => {
    const { code } = await issue();
    const [prefix, body, sig] = code.split(".");
    const json = Buffer.from(body!, "base64url").toString("utf8");
    const edited = json.replace('"dag_no":141', '"dag_no":143'); // one digit
    expect(edited).not.toBe(json);
    const forged = [prefix, Buffer.from(edited).toString("base64url"), sig].join(".");
    const r = await check(forged);
    expect(r.overall).toBe("red");
    expect(r.overall_en).toBe("NOT GENUINE");
    expect(r.lights.genuine.ok).toBe(false);
  });

  it("re-verify an old report after a new event on the dag → GENUINE but SUPERSEDED (amber)", async () => {
    const { code } = await issue();
    await registerEvent({ type: "baina", mouza: "Nayapara", dagNo: 141, ownerId: ANWAR, counterpartyId: OWNER.SALMA, area: 2 }); // prettier-ignore
    const r = await check(code);
    expect(r.overall).toBe("amber");
    expect(r.overall_en).toBe("GENUINE BUT SUPERSEDED");
    expect(r.lights.genuine.ok).toBe(true);
    expect(r.lights.current).toMatchObject({ ok: false, events_since: 1 });
    expect(r.lights.untouched.ok).toBe(true);
    expect(r.lights.shares_add_up.ok).toBe(true);
  });

  it("a seal whose issue is missing from the log, or a broken log, is not 'untouched'", async () => {
    const { code } = await issue();
    await sql`update audit_log set role = 'admin' where action = 'seal_issue'`;
    expect((await verifySeal(code)).lights.untouched.ok).toBe(false);
    await seed(sql); // the demo reset empties the log
    const r = await verifySeal(code);
    expect(r.lights.genuine.ok).toBe(true);
    expect(r.lights.untouched).toMatchObject({ ok: false, bn: expect.stringContaining("পাওয়া যায়নি") }); // prettier-ignore
  });

  it("rubbish is not a seal", async () => {
    expect((await verifySeal("hello")).overall_en).toBe("NOT A BHUMISEAL");
    expect((await verifySeal("BS1.!!!.???")).overall).toBe("red");
  });
});

describe("who checked my land", () => {
  it("Anwar sees who looked at dag 141 by role only; others see nothing", async () => {
    await runTool("jomi_check", dag141, { user: null });
    await runTool("ledger_status", dag141, { user: officer });
    await runTool("jomi_check", { mouza: "Nayapara", dag_no: 145 }, { user: null }); // not his dag

    const mine = await whoCheckedMyLand(anwar);
    expect(mine.map((e) => [e.action, e.role_bn])).toEqual([
      ["view_ledger", "সাব-রেজিস্ট্রি কর্মকর্তা"],
      ["view_report", "লগইন ছাড়া একজন দর্শক"],
    ]);
    expect(mine.every((e) => e.dag_no === 141)).toBe(true);

    const r = (await runTool("who_checked", {}, { user: other })) as { linked: boolean };
    expect(r.linked).toBe(false);
    const raw = await withUser(other, (tx) => tx`select id from audit_log`);
    expect(raw).toHaveLength(0); // RLS: no land, no rows
  });

  it("nobody can read who the other people were (actor column not granted)", async () => {
    await runTool("jomi_check", dag141, { user: null });
    await expect(withUser(anwar, (tx) => tx`select actor from audit_log`)).rejects.toThrow(/permission denied/); // prettier-ignore
    await expect(withUser(officer, (tx) => tx`select body from audit_log`)).rejects.toThrow(/permission denied/); // prettier-ignore
    const all = await withUser(officer, (tx) => tx`select id from audit_log`);
    expect(all.length).toBeGreaterThan(0); // officers see all entries (without identities)
  });
});

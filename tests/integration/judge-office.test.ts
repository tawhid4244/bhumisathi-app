import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/roles";
import { upsertUser } from "@/lib/auth/session";
import { verifyAuditChain } from "@/lib/engines/audit";
import { listAccounts, officeSummary, recentAudit } from "@/lib/engines/office";
import { JUDGE_STEPS, runJudgeStep } from "@/lib/demo/judge";
import { closeSql, getSql } from "@/lib/sql";

// Task 18: judge mode runs G1 → G3 → G8 → G2 → G7 end to end; the office view hides identities.

process.env.AI_PROVIDER = "mock"; // scripted model + mock deed reader: no network, no cost
process.env.EMBEDDING_PROVIDER = "none";
process.env.SEAL_PRIVATE_KEY ??= generateKeyPairSync("ed25519")
  .privateKey.export({ format: "der", type: "pkcs8" })
  .toString("base64");

const sql = getSql();
let officer: SessionUser;

beforeAll(async () => {
  const id = await upsertUser({ email: "officer@office.test", name_bn: "ক", role: "officer", passwordHash: "scrypt$1$1$1$x$y" }); // prettier-ignore
  officer = { id, email: "officer@office.test", name_bn: "ক", role: "officer" };
});
afterAll(async () => {
  await sql`delete from users where email like '%@office.test'`;
  await closeSql();
});

describe("judge mode tour", () => {
  it("has nine fixed steps that tell the five stories with the expected outcomes", async () => {
    expect(JUDGE_STEPS).toHaveLength(9);
    const cards = [];
    for (let i = 0; i < JUDGE_STEPS.length; i++) cards.push(await runJudgeStep(i));
    expect(cards.map((c) => c.scenario)).toEqual(["শুরু", "G1", "G1", "G1", "G3", "G8", "G2", "G7", "G7"]); // prettier-ignore
    expect(cards.map((c) => c.verdict ?? null)).toEqual([null, "green", "red", "green", "amber", "red", "green", "green", "amber"]); // prettier-ignore
    expect(cards[2]!.lines[0]).toMatch(/১০/); // only 10 sellable
    // G8 runs after G1: Sathi finds nothing left to sell on dag 145, the same verdict as /check.
    expect(cards[6]!.lines).toHaveLength(4); // wife, two sons, daughter
    expect(cards[7]!.qr_svg).toContain("<svg");
    for (const c of cards) expect(c.caption_bn.length).toBeGreaterThan(20);
    // Every scripted write went through the audit log, and the chain holds.
    const writes =
      await sql`select action, role from audit_log where action like 'register_%' order by id`;
    expect(writes.map((w) => w.role)).toEqual(["officer", "officer", "officer", "officer"]);
    expect((await verifyAuditChain()).ok).toBe(true);
  });

  it("refuses a step number that does not exist", async () => {
    await expect(runJudgeStep(99)).rejects.toThrow(RangeError);
  });
});

describe("office view", () => {
  it("summarises the day and lists the audit trail without anyone's identity", async () => {
    const s = await officeSummary();
    expect(s.dags).toBeGreaterThanOrEqual(60);
    expect(s.seals).toBeGreaterThanOrEqual(1);
    const audit = await recentAudit(officer, 5);
    expect(audit.length).toBe(5);
    for (const a of audit) expect(Object.keys(a)).not.toContain("actor");
  });

  it("lists accounts without password hashes", async () => {
    const rows = await listAccounts();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(Object.keys(r)).not.toContain("password_hash");
  });
});

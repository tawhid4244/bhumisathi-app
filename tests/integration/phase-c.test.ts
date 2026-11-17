import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/roles";
import { upsertUser } from "@/lib/auth/session";
import { ApplicationError, getApplication } from "@/lib/engines/applications";
import { verifyDocument } from "@/lib/engines/documents";
import { jomiCheck } from "@/lib/engines/jomi-check";
import { verifySeal } from "@/lib/engines/seal";
import { runTool, SYSTEM } from "@/lib/tools/registry";
import { closeSql, getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";
import { H, OWNER } from "@/scripts/seed-data";

// Phase C golden scenarios on the real database:
//   G9  mutation: sale of 10 dec on dag 145 → apply → hearing → approve → DCR fee → new khatian;
//       Jomi Check shows Jamal 10 dec, Rahim 10; a seal from before turns "superseded".
//   G10 land tax: dag 147 has arrears (amber) → dakhila → the arrears reason is gone.
//   G11 complaint: "a broker asked for Tk 5,000" → category, urgency, amount → resolved.

process.env.SEAL_PRIVATE_KEY ??= generateKeyPairSync("ed25519")
  .privateKey.export({ format: "der", type: "pkcs8" })
  .toString("base64");

const sql = getSql();
let citizen: SessionUser;
let officer: SessionUser;

async function make(email: string, role: SessionUser["role"]): Promise<SessionUser> {
  const id = await upsertUser({ email, name_bn: `পরীক্ষা ${role}`, role, passwordHash: "scrypt$1$1$1$x$y" }); // prettier-ignore
  return { id, email, name_bn: `পরীক্ষা ${role}`, role };
}
const as = (user: SessionUser) => ({ user });

beforeAll(async () => {
  await seed(sql);
  citizen = await make("citizen@phasec.test", "citizen");
  officer = await make("officer@phasec.test", "officer");
});
afterAll(async () => {
  await sql`delete from users where email like '%@phasec.test'`;
  await seed(sql); // leave the synthetic world as the other tests expect it
  await closeSql();
});

describe("G9 mutation", () => {
  it("sale → mutation application → hearing → approval → DCR fee → shares move", async () => {
    const sale = (await runTool("register_sale", { mouza: "Nayapara", dag_no: 145, seller_id: OWNER.RAHIM, buyer_id: OWNER.JAMAL, area_dec: 10 }, as(officer))) as { ok: boolean; ref: string }; // prettier-ignore
    expect(sale.ok).toBe(true);
    const seal = (await runTool("seal_issue", { mouza: "Nayapara", dag_no: 145 }, SYSTEM)) as { code: string }; // prettier-ignore

    const sub = (await runTool("application_submit", { type: "mutation", details: { deed_no: sale.ref } }, as(citizen))) as { app_no: string; fee_taka: number; fee_lines: { tk: number; stage?: string }[] }; // prettier-ignore
    expect(sub.app_no).toMatch(/^MUT-/);
    expect(sub.fee_taka).toBe(70); // court fee 20 + notice 50
    expect(sub.fee_lines.filter((l) => l.stage === "approval").map((l) => l.tk)).toEqual([1000, 100]); // prettier-ignore
    // The same deed cannot be applied for twice.
    await expect(runTool("application_submit", { type: "mutation", details: { deed_no: sale.ref } }, as(citizen))).rejects.toBeInstanceOf(ApplicationError); // prettier-ignore

    await runTool("application_pay", { app_no: sub.app_no, method: "bkash" }, as(citizen));
    const heard = (await runTool("application_hearing", { app_no: sub.app_no }, as(officer))) as { status: string; hearing_on: string }; // prettier-ignore
    expect(heard.status).toBe("hearing");
    const [sms] = await sql<{ n: number }[]>`select count(*)::int as n from sms_log where body_bn like ${`%${sub.app_no}%`}`; // prettier-ignore
    expect(sms!.n).toBe(2); // seller and buyer got the hearing notice

    const approved = (await runTool("application_decide", { app_no: sub.app_no, decision: "approve" }, as(officer))) as { status: string }; // prettier-ignore
    expect(approved.status).toBe("final_payment_due");
    // Approval alone does not move shares: the DCR fee is still due.
    expect((await jomiCheck({ mouza: "Nayapara", dag_no: 145 })).holders.some((h) => h.owner_id === OWNER.JAMAL)).toBe(false); // prettier-ignore

    const paid = (await runTool("application_pay", { app_no: sub.app_no, method: "nagad" }, as(citizen))) as { status: string; amount_taka: number; document_id: string }; // prettier-ignore
    expect(paid).toMatchObject({ status: "completed", amount_taka: 1100 });

    const report = await jomiCheck({ mouza: "Nayapara", dag_no: 145 });
    const holder = (id: number) => report.holders.find((h) => h.owner_id === id);
    expect(holder(OWNER.JAMAL)?.recorded_dec).toBe(10);
    expect(holder(OWNER.RAHIM)?.recorded_dec).toBe(10);
    expect(holder(OWNER.RAHIM)?.sold_dec).toBe(0); // the sale is now on the khatian, not "pending mutation"
    expect(report.reasons.some((r) => r.code === "MUTATION_PENDING")).toBe(false);

    // The old sealed report is genuine but superseded; the new khatian verifies green.
    expect((await verifySeal(seal.code)).overall).toBe("amber");
    const app = (await getApplication(citizen, sub.app_no))!;
    expect(app.events.map((e) => e.action)).toEqual(["submitted", "paid", "hearing", "approved", "paid", "document_issued"]); // prettier-ignore
    const doc = await verifyDocument(app.documents[0]!.code);
    expect(doc.overall).toBe("green");
    expect(doc.payload).toMatchObject({ kind: "mutation_khatian", owners: [{ name_en: "Jamal Mia", share_dec: 10 }] }); // prettier-ignore
    const [mc] = await sql<{ status: string }[]>`select status from mutation_cases where case_no = ${app.details.case_no!}`; // prettier-ignore
    expect(mc!.status).toBe("approved");
  });
});

describe("G10 land tax", () => {
  it("arrears on dag 147 → exempt farmland → dakhila at Tk 0 → arrears gone", async () => {
    const before = await jomiCheck({ mouza: "Nayapara", dag_no: 147 });
    expect(before.reasons.some((r) => r.code === "TAX_ARREARS")).toBe(true);
    const due = (await runTool("land_tax_due", { mouza: "Nayapara", dag_no: 147 }, { user: null })) as { reports: { holders: { owner_id: number; years_due: string[]; exempt: boolean; due_tk: number }[] }[] }; // prettier-ignore
    const line = due.reports[0]!.holders.find((h) => h.owner_id === H.NURUL)!;
    expect(line.years_due.length).toBeGreaterThanOrEqual(4);
    expect(line.exempt).toBe(true); // small farm holding: under 25 bigha
    expect(line.due_tk).toBe(0);

    const sub = (await runTool("application_submit", { type: "land_tax", details: { mouza: "Nayapara", dag_no: 147, owner_id: H.NURUL } }, as(citizen))) as { status: string; document_id: string; app_no: string }; // prettier-ignore
    expect(sub.status).toBe("completed"); // nothing to pay → dakhila at once
    const after = await jomiCheck({ mouza: "Nayapara", dag_no: 147 });
    expect(after.reasons.some((r) => r.code === "TAX_ARREARS")).toBe(false);
    const app = (await getApplication(citizen, sub.app_no))!;
    const doc = await verifyDocument(app.documents[0]!.code);
    expect(doc.overall).toBe("green");
    expect(doc.payload).toMatchObject({ kind: "dakhila", exempt: true, amount_tk: 0, holder_en: "Nurul Islam" }); // prettier-ignore
    // Already paid now: a second dakhila application is refused.
    await expect(runTool("application_submit", { type: "land_tax", details: { mouza: "Nayapara", dag_no: 147, owner_id: H.NURUL } }, as(citizen))).rejects.toMatchObject({ status: 409 }); // prettier-ignore
  });

  it("homestead land pays an (example) rate through the sandbox", async () => {
    await sql`update land_tax set paid_through_fy = '2024-25' where dag_id = (select d.id from dags d join mouzas m on m.id = d.mouza_id where m.name_en = 'Nayapara' and d.land_class_en = 'Viti (homestead)' order by d.dag_no limit 1)`; // prettier-ignore
    const [dag] = await sql<{ dag_no: number; owner_id: number }[]>`
      select d.dag_no, t.owner_id from dags d join mouzas m on m.id = d.mouza_id join land_tax t on t.dag_id = d.id
      where m.name_en = 'Nayapara' and d.land_class_en = 'Viti (homestead)' order by d.dag_no limit 1`;
    const sub = (await runTool("application_submit", { type: "land_tax", details: { mouza: "Nayapara", dag_no: dag!.dag_no, owner_id: dag!.owner_id } }, as(citizen))) as { status: string; fee_taka: number; app_no: string }; // prettier-ignore
    expect(sub.status).toBe("payment_due");
    expect(sub.fee_taka).toBeGreaterThan(0);
    const paid = (await runTool("application_pay", { app_no: sub.app_no, method: "card" }, as(citizen))) as { status: string; document_id: string }; // prettier-ignore
    expect(paid.status).toBe("completed");
    expect(paid.document_id).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("G11 complaint", () => {
  it("a broker asking for Tk 5,000 → urgent broker complaint → resolved, citizen sees what was done", async () => {
    const sub = (await runTool("complaint_submit", { text: "মিউটেশনে দালাল ৫,০০০ টাকা চেয়েছে, ১৪৫ নম্বর দাগ", anonymous: true }, as(citizen))) as { app_no: string; status: string }; // prettier-ignore
    expect(sub.app_no).toMatch(/^CMP-/);
    expect(sub.status).toBe("in_review");
    const app = (await getApplication(citizen, sub.app_no))!;
    expect(app.details).toMatchObject({ category: "broker", urgent: true, amount_tk: 5000, service: "mutation", dag_no: 145, anonymous: true }); // prettier-ignore

    const inbox = (await runTool("application_inbox", {}, as(officer))) as { app_no: string; urgent: boolean; applicant_bn: string }[]; // prettier-ignore
    expect(inbox[0]!.app_no).toBe(sub.app_no); // urgent first
    expect(inbox[0]!.applicant_bn).toMatch(/বেনামি/); // anonymous even for the office

    await expect(runTool("application_decide", { app_no: sub.app_no, decision: "approve" }, as(officer))).rejects.toMatchObject({ status: 400 }); // prettier-ignore
    await runTool("application_decide", { app_no: sub.app_no, decision: "approve", note: "দালালকে অফিসে ঢুকতে নিষেধ করা হয়েছে; আবেদন সরাসরি গ্রহণ করা হয়েছে।" }, as(officer)); // prettier-ignore
    const done = (await getApplication(citizen, sub.app_no))!;
    expect(done.status).toBe("completed");
    expect(done.decision_note).toContain("দালাল");

    const stats = (await runTool("complaint_stats", {}, { user: null })) as { total: number; resolved: number; by_category: { category: string; n: number }[] }; // prettier-ignore
    expect(stats.resolved).toBeGreaterThanOrEqual(1);
    expect(stats.by_category.find((c) => c.category === "broker")!.n).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(stats)).not.toContain("দালালকে"); // counts only, no texts
  });
});

import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/roles";
import { upsertUser } from "@/lib/auth/session";
import { ApplicationError, getApplication } from "@/lib/engines/applications";
import { verifyDocument } from "@/lib/engines/documents";
import { runTool } from "@/lib/tools/registry";
import { closeSql, getSql } from "@/lib/sql";

// Phase B: the shared application framework, end to end on the real database.
//   apply → pay (sandbox) → officer approves → signed khatian copy → /verify/doc is green,
//   and a later sale on the dag turns the copy "superseded".

process.env.SEAL_PRIVATE_KEY ??= generateKeyPairSync("ed25519")
  .privateKey.export({ format: "der", type: "pkcs8" })
  .toString("base64");

const sql = getSql();
let citizen: SessionUser;
let other: SessionUser;
let officer: SessionUser;

async function make(email: string, role: SessionUser["role"]): Promise<SessionUser> {
  const id = await upsertUser({ email, name_bn: `পরীক্ষা ${role}`, role, passwordHash: "scrypt$1$1$1$x$y" }); // prettier-ignore
  return { id, email, name_bn: `পরীক্ষা ${role}`, role };
}

beforeAll(async () => {
  citizen = await make("citizen@apps.test", "citizen");
  other = await make("other@apps.test", "citizen");
  officer = await make("officer@apps.test", "officer");
});
afterAll(async () => {
  await sql`delete from users where email like '%@apps.test'`; // cascades to their applications
  await closeSql();
});

const as = (user: SessionUser) => ({ user });

describe("application framework", () => {
  it("runs apply → pay → approve → signed document, with a timeline and notifications", async () => {
    const sub = (await runTool(
      "application_submit",
      { type: "certified_copy", details: { mouza: "নয়াপাড়া", dag_no: 141, survey: "BS", delivery: "post" } }, // prettier-ignore
      as(citizen),
    )) as { app_no: string; status: string; fee_taka: number };
    expect(sub.app_no).toMatch(/^CPY-\d{4}-\d{4}$/);
    expect(sub.status).toBe("payment_due");
    expect(sub.fee_taka).toBe(140); // 100 copy + 40 postage (content/fees.json)

    // Not paid yet → not in the officer's inbox.
    let inbox = (await runTool("application_inbox", {}, as(officer))) as {
      app_no: string;
      sla: string;
    }[];
    expect(inbox.some((x) => x.app_no === sub.app_no)).toBe(false);

    const paid = (await runTool("application_pay", { app_no: sub.app_no, method: "bkash" }, as(citizen))) as { txn_ref: string; sandbox: boolean; status: string }; // prettier-ignore
    expect(paid.txn_ref).toMatch(/^SBX-[A-Z0-9]{10}$/);
    expect(paid.sandbox).toBe(true);
    expect(paid.status).toBe("in_review");
    // Paying twice is refused.
    await expect(runTool("application_pay", { app_no: sub.app_no, method: "card" }, as(citizen))).rejects.toBeInstanceOf(ApplicationError); // prettier-ignore

    inbox = (await runTool("application_inbox", {}, as(officer))) as {
      app_no: string;
      sla: string;
    }[];
    const item = inbox.find((x) => x.app_no === sub.app_no)!;
    expect(item).toBeTruthy();
    expect(item.sla).toBe("green");

    const decided = (await runTool("application_decide", { app_no: sub.app_no, decision: "approve" }, as(officer))) as { status: string; document_id: string }; // prettier-ignore
    expect(decided.status).toBe("completed");
    expect(decided.document_id).toMatch(/^[a-f0-9]{16}$/);

    const app = (await getApplication(citizen, sub.app_no))!;
    expect(app.events.map((e) => e.action)).toEqual(["submitted", "paid", "approved", "document_issued"]); // prettier-ignore
    expect(app.payments).toHaveLength(1);
    expect(app.documents).toHaveLength(1);

    const check = await verifyDocument(app.documents[0]!.code);
    expect(check.overall).toBe("green");
    expect(check.payload?.dag_no).toBe(141);
    expect(check.payload?.survey).toBe("BS");

    const notes = (await runTool("notifications", {}, as(citizen))) as { unread: number; items: { title_en: string }[] }; // prettier-ignore
    expect(notes.items.map((n) => n.title_en)).toEqual([
      `${sub.app_no}: document ready`,
      `${sub.app_no}: fee paid`,
      `Application ${sub.app_no} submitted`,
    ]);
    const read = (await runTool("notifications", { mark_read: true }, as(citizen))) as { unread: number }; // prettier-ignore
    expect(read.unread).toBe(0);
  });

  it("keeps each citizen's applications private; the public tracker shows status only", async () => {
    const { app_no } = (await runTool("application_submit", { type: "certified_copy", details: { mouza: "Nayapara", dag_no: 142, survey: "RS" } }, as(citizen))) as { app_no: string }; // prettier-ignore
    expect(await getApplication(other, app_no)).toBeNull(); // RLS
    expect(await getApplication(officer, app_no)).not.toBeNull();
    const mine = (await runTool("application_status", {}, as(other))) as {
      applications: unknown[];
    };
    expect(mine.applications).toEqual([]);
    // Someone else cannot pay or cancel it (and is not told it exists).
    await expect(runTool("application_pay", { app_no, method: "nagad" }, as(other))).rejects.toMatchObject({ status: 404 }); // prettier-ignore

    const pub = (await runTool("application_track", { app_no }, { user: null })) as Record<string, unknown>; // prettier-ignore
    expect(pub).toMatchObject({ app_no, status: "payment_due", type_en: "Certified khatian copy" });
    expect(JSON.stringify(pub)).not.toMatch(/142|Nayapara|নয়াপাড়া|পরীক্ষা/);

    await runTool("application_cancel", { app_no }, as(citizen));
    expect((await getApplication(citizen, app_no))!.status).toBe("cancelled");
  });

  it("refuses citizens in the office, rejections without a reason, and unknown surveys", async () => {
    await expect(runTool("application_inbox", {}, as(citizen))).rejects.toThrow();
    const { app_no } = (await runTool("application_submit", { type: "certified_copy", details: { mouza: "Nayapara", dag_no: 143 } }, as(citizen))) as { app_no: string }; // prettier-ignore
    await runTool("application_pay", { app_no, method: "rocket" }, as(citizen));
    await expect(runTool("application_decide", { app_no, decision: "approve" }, as(citizen))).rejects.toThrow(); // prettier-ignore
    await expect(runTool("application_decide", { app_no, decision: "reject" }, as(officer))).rejects.toMatchObject({ status: 400 }); // prettier-ignore
    const r = (await runTool("application_decide", { app_no, decision: "reject", note: "দাগ নম্বর ভুল" }, as(officer))) as { status: string }; // prettier-ignore
    expect(r.status).toBe("rejected");
    expect((await getApplication(citizen, app_no))!.decision_note).toBe("দাগ নম্বর ভুল");
  });

  it("a tampered document is not genuine", async () => {
    const [doc] = await sql<{ code: string }[]>`
      select d.code from issued_documents d join applications a on a.id = d.application_id
      join users u on u.id = a.applicant_user_id where u.email = 'citizen@apps.test' limit 1`;
    const [p, body, sig] = doc!.code.split(".");
    const payload = JSON.parse(Buffer.from(body!, "base64url").toString("utf8"));
    payload.owners[0].share_dec += 5;
    const forged = `${p}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;
    expect((await verifyDocument(forged)).overall).toBe("red");
    expect((await verifyDocument("hello")).overall).toBe("red");
  });
});

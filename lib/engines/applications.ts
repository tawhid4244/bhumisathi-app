import type postgres from "postgres";
import { withUser } from "../auth/db";
import { allowed, type SessionUser } from "../auth/roles";
import { chargeSandbox, METHOD_LABEL, type PaymentMethod } from "../adapters/payment";
import {
  APPLICATION_TYPES,
  feeFor,
  type ApplicationTypeId,
  type CopyDetails,
  type FeeLine,
} from "../services/catalog";
import { getSql } from "../sql";
import { appendAudit } from "./audit";
import { signDocument } from "./documents";
import { resolveDag } from "./ledger";
import { loadDagFacts } from "./records";
import { bn } from "./rules";

// The shared application framework: apply → pay (sandbox) → office review → decision → signed
// document. One state machine for every service type (lib/services/catalog.ts):
//
//   payment_due ──pay──▶ in_review ──approve──▶ completed (document issued)
//        │                    └──────reject───▶ rejected
//        └──cancel──▶ cancelled
//
// Writes happen here only, as trusted code, after checking who is acting. Citizens read their
// applications through Row Level Security (withUser), so nobody sees another person's rows.
// Every step goes into the application's timeline, the hash-chained audit log, and the bell.

export class ApplicationError extends Error {
  constructor(
    readonly bn: string,
    en: string,
    readonly status = 409,
  ) {
    super(en);
    this.name = "ApplicationError";
  }
}

export type AppStatus = "payment_due" | "in_review" | "completed" | "rejected" | "cancelled";

export interface AppEvent {
  at: string;
  actor_role: string;
  action: string;
  note_bn: string;
  note_en: string;
}

export interface AppDocument {
  id: string;
  kind: string;
  code: string;
  issued_at: string;
  revoked: boolean;
}

export interface Application {
  app_no: string;
  type: ApplicationTypeId;
  status: AppStatus;
  details: CopyDetails & { mouza_bn?: string; mouza_en?: string };
  fee_taka: number;
  fee_lines: FeeLine[];
  submitted_at: string;
  updated_at: string;
  due_on: string | null;
  decision_note: string | null;
  /** The viewer is the applicant (an officer may also open it). */
  applicant_is_me: boolean;
  events: AppEvent[];
  payments: { txn_ref: string; amount_taka: number; method: string; paid_at: string }[];
  documents: AppDocument[];
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : String(d));
const day = (d: Date | string | null) =>
  d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

async function notify(
  tx: postgres.Sql | postgres.TransactionSql,
  userId: string,
  n: { title_bn: string; title_en: string; body_bn: string; body_en: string; link: string },
) {
  await tx`insert into notifications (user_id, title_bn, title_en, body_bn, body_en, link)
           values (${userId}, ${n.title_bn}, ${n.title_en}, ${n.body_bn}, ${n.body_en}, ${n.link})`;
}

// ---------------------------------------------------------------- submit

export async function submitApplication(
  user: SessionUser,
  type: ApplicationTypeId,
  details: CopyDetails,
): Promise<{ app_no: string; status: AppStatus; fee_taka: number; fee_lines: FeeLine[] }> {
  const def = APPLICATION_TYPES[type];
  if (!def) throw new ApplicationError("এই সেবা এখনও চালু হয়নি।", "This service is not open yet.", 400); // prettier-ignore
  const dag = await resolveDag(details.mouza, details.dag_no); // DagNotFoundError → 404
  const facts = await loadDagFacts(details.mouza, details.dag_no);
  if (!facts.chain.some((c) => c.survey === details.survey)) {
    throw new ApplicationError(
      `এই দাগের ${details.survey} খতিয়ান রেকর্ডে নেই।`,
      `There is no ${details.survey} khatian for this dag in the records.`,
      400,
    );
  }
  const fee_lines = feeFor(type, details);
  const fee = fee_lines.reduce((t, l) => t + l.tk, 0);
  const status: AppStatus = fee > 0 ? "payment_due" : "in_review";
  const stored = { ...details, mouza: dag.mouza_en, mouza_bn: dag.mouza_bn, mouza_en: dag.mouza_en }; // prettier-ignore

  const app_no = await getSql().begin(async (tx) => {
    const [{ no }] = (await tx`
      select next_app_no(${def.prefix}, extract(year from bd_today())::int) as no`) as unknown as [{ no: string }]; // prettier-ignore
    const [{ id }] = (await tx`
      insert into applications (app_no, type, applicant_user_id, dag_id, status, details, fee_taka, due_on)
      values (${no}, ${type}, ${user.id}, ${dag.id}, ${status}, ${tx.json(stored)}, ${fee},
              ${status === "in_review" ? tx`bd_today() + ${def.sla_days}::int` : null})
      returning id`) as unknown as [{ id: string }];
    await tx`insert into application_events (application_id, actor_role, action, note_bn, note_en)
      values (${id}, ${user.role}, 'submitted',
              ${`${def.bn}-এর আবেদন জমা হয়েছে (${dag.mouza_bn} দাগ ${bn(dag.dag_no)}, ${details.survey} খতিয়ান)।`},
              ${`Application for a ${def.en.toLowerCase()} submitted (${dag.mouza_en} dag ${dag.dag_no}, ${details.survey} khatian).`})`;
    await notify(tx, user.id, {
      title_bn: `আবেদন ${no} জমা হয়েছে`,
      title_en: `Application ${no} submitted`,
      body_bn:
        fee > 0 ? `ফি ${bn(fee)} টাকা পরিশোধ করলে অফিস যাচাই শুরু করবে।` : "অফিস যাচাই শুরু করবে।",
      body_en: fee > 0 ? `Pay the fee of Tk ${fee} and the office will start the review.` : "The office will start the review.", // prettier-ignore
      link: `/my/applications/${no}`,
    });
    return no;
  });
  await appendAudit({ user, action: "app_submit", dag_id: dag.id, detail: { app_no, type } });
  return { app_no, status, fee_taka: fee, fee_lines };
}

// ---------------------------------------------------------------- read

/** One application with its timeline, payments and documents; null if this user may not see it. */
export async function getApplication(
  user: SessionUser,
  appNo: string,
): Promise<Application | null> {
  // prettier-ignore
  return withUser(user, async (tx) => {
    const [a] = await tx<
      {
        id: string;
        app_no: string;
        type: ApplicationTypeId;
        status: AppStatus;
        details: Application["details"];
        fee_taka: number;
        submitted_at: Date;
        updated_at: Date;
        due_on: Date | null;
        decision_note: string | null;
        mine: boolean;
      }[]
    >`select id, app_no, type, status, details, fee_taka, submitted_at, updated_at, due_on, decision_note,
             applicant_user_id = ${user.id} as mine
      from applications where app_no = ${appNo}`;
    if (!a) return null;
    const [events, payments, documents] = await Promise.all([
      tx<(AppEvent & { at: Date })[]>`
        select at, actor_role, action, note_bn, note_en from application_events
        where application_id = ${a.id} order by id`,
      tx<{ txn_ref: string; amount_taka: number; method: string; paid_at: Date }[]>`
        select txn_ref, amount_taka, method, paid_at from payments where application_id = ${a.id} order by id`, // prettier-ignore
      tx<(AppDocument & { issued_at: Date })[]>`
        select id, kind, code, issued_at, revoked from issued_documents where application_id = ${a.id} order by issued_at`, // prettier-ignore
    ]);
    return {
      app_no: a.app_no,
      type: a.type,
      status: a.status,
      details: a.details,
      fee_taka: a.fee_taka,
      fee_lines: feeFor(a.type, a.details),
      submitted_at: iso(a.submitted_at),
      updated_at: iso(a.updated_at),
      due_on: day(a.due_on),
      decision_note: a.decision_note,
      applicant_is_me: a.mine,
      events: events.map((e) => ({ ...e, at: iso(e.at) })),
      payments: payments.map((p) => ({ ...p, paid_at: iso(p.paid_at) })),
      documents: documents.map((d) => ({ ...d, issued_at: iso(d.issued_at) })),
    };
  });
}

export interface AppSummary {
  app_no: string;
  type: ApplicationTypeId;
  status: AppStatus;
  mouza_bn: string;
  mouza_en: string;
  dag_no: number;
  fee_taka: number;
  submitted_at: string;
  updated_at: string;
  due_on: string | null;
  has_document: boolean;
}

/** The signed-in citizen's own applications, newest first (RLS: only theirs). */
export async function myApplications(user: SessionUser, limit = 50): Promise<AppSummary[]> {
  return withUser(user, async (tx) => {
    type Row = Omit<AppSummary, "submitted_at" | "updated_at" | "due_on"> & {
      submitted_at: Date;
      updated_at: Date;
      due_on: Date | null;
    };
    const rows = await tx<Row[]>`
      select a.app_no, a.type, a.status, a.details->>'mouza_bn' as mouza_bn, a.details->>'mouza_en' as mouza_en,
             (a.details->>'dag_no')::int as dag_no, a.fee_taka, a.submitted_at, a.updated_at, a.due_on,
             exists (select 1 from issued_documents d where d.application_id = a.id and not d.revoked) as has_document
      from applications a where a.applicant_user_id = ${user.id}
      order by a.id desc limit ${limit}`;
    return rows.map((r) => ({ ...r, submitted_at: iso(r.submitted_at), updated_at: iso(r.updated_at), due_on: day(r.due_on) })); // prettier-ignore
  });
}

/** Public tracker: status only, no names and no land details. */
export async function trackApplication(appNo: string) {
  type Row = { type: ApplicationTypeId; status: AppStatus; submitted_at: Date; updated_at: Date; due_on: Date | null }; // prettier-ignore
  const [a] = await getSql()<Row[]>`
    select type, status, submitted_at, updated_at, due_on from applications where app_no = ${appNo}`;
  if (!a) return null;
  const def = APPLICATION_TYPES[a.type];
  return {
    app_no: appNo,
    type_bn: def?.bn ?? a.type,
    type_en: def?.en ?? a.type,
    status: a.status,
    submitted_on: day(a.submitted_at)!,
    updated_on: day(a.updated_at)!,
    due_on: day(a.due_on),
  };
}

// ---------------------------------------------------------------- pay / cancel (applicant)

export async function payApplication(user: SessionUser, appNo: string, method: PaymentMethod) {
  const result = await getSql().begin(async (tx) => {
    const [a] = (await tx`
      select id, type, status, fee_taka, applicant_user_id, dag_id from applications
      where app_no = ${appNo} for update`) as unknown as { id: string; type: ApplicationTypeId; status: AppStatus; fee_taka: number; applicant_user_id: string; dag_id: number }[]; // prettier-ignore
    // Not yours = not found (no hint that the number exists).
    if (!a || a.applicant_user_id !== user.id) throw new ApplicationError("আবেদনটি পাওয়া যায়নি।", "Application not found.", 404); // prettier-ignore
    if (a.status !== "payment_due") throw new ApplicationError("এই আবেদনের ফি আগেই পরিশোধ হয়েছে বা আর প্রযোজ্য নয়।", "The fee is already paid or no longer due.", 409); // prettier-ignore
    const def = APPLICATION_TYPES[a.type];
    const receipt = chargeSandbox(a.fee_taka, method);
    await tx`insert into payments (application_id, amount_taka, method, txn_ref, status)
             values (${a.id}, ${receipt.amount_taka}, ${method}, ${receipt.txn_ref}, 'paid')`;
    const [{ due }] = (await tx`
      update applications set status = 'in_review', updated_at = now(), due_on = bd_today() + ${def.sla_days}::int
      where id = ${a.id} returning due_on as due`) as unknown as [{ due: Date }];
    const label = METHOD_LABEL[method];
    await tx`insert into application_events (application_id, actor_role, action, note_bn, note_en)
      values (${a.id}, ${user.role}, 'paid',
              ${`ফি ${bn(receipt.amount_taka)} টাকা পরিশোধ (${label.bn}, রসিদ ${receipt.txn_ref})। অফিস যাচাই শুরু করেছে।`},
              ${`Fee of Tk ${receipt.amount_taka} paid (${label.en}, receipt ${receipt.txn_ref}). The office review has started.`})`;
    await notify(tx, user.id, {
      title_bn: `${appNo}: ফি পরিশোধ হয়েছে`,
      title_en: `${appNo}: fee paid`,
      body_bn: `রসিদ ${receipt.txn_ref}। সিদ্ধান্তের শেষ তারিখ ${bn(day(due)!)}।`,
      body_en: `Receipt ${receipt.txn_ref}. Decision due by ${day(due)}.`,
      link: `/my/applications/${appNo}`,
    });
    return { dag_id: a.dag_id, receipt, due_on: day(due)! };
  });
  await appendAudit({ user, action: "app_pay", dag_id: result.dag_id, detail: { app_no: appNo, txn_ref: result.receipt.txn_ref, amount_taka: result.receipt.amount_taka } }); // prettier-ignore
  const { txn_ref, amount_taka, method: paid_with, sandbox } = result.receipt;
  return { app_no: appNo, status: "in_review" as const, txn_ref, amount_taka, method: paid_with, sandbox, due_on: result.due_on }; // prettier-ignore
}

export async function cancelApplication(user: SessionUser, appNo: string) {
  await getSql().begin(async (tx) => {
    const [a] = (await tx`select id, status, applicant_user_id from applications where app_no = ${appNo} for update`) as unknown as { id: string; status: AppStatus; applicant_user_id: string }[]; // prettier-ignore
    if (!a || a.applicant_user_id !== user.id) throw new ApplicationError("আবেদনটি পাওয়া যায়নি।", "Application not found.", 404); // prettier-ignore
    if (a.status !== "payment_due") throw new ApplicationError("ফি পরিশোধের পর আবেদন বাতিল করা যায় না।", "An application cannot be cancelled after payment.", 409); // prettier-ignore
    await tx`update applications set status = 'cancelled', updated_at = now() where id = ${a.id}`;
    await tx`insert into application_events (application_id, actor_role, action, note_bn, note_en)
      values (${a.id}, ${user.role}, 'cancelled', 'আবেদনকারী আবেদনটি বাতিল করেছেন।', 'The applicant cancelled the application.')`; // prettier-ignore
  });
  return { app_no: appNo, status: "cancelled" as const };
}

// ---------------------------------------------------------------- office

export interface InboxItem {
  app_no: string;
  type: ApplicationTypeId;
  applicant_bn: string;
  mouza_bn: string;
  mouza_en: string;
  dag_no: number;
  survey: string;
  fee_taka: number;
  paid_ref: string | null;
  due_on: string | null;
  /** green: more than 2 days left · amber: 0–2 days · red: overdue */
  sla: "green" | "amber" | "red";
  days_left: number | null;
}

/** Applications waiting for an officer, the most urgent first. */
export async function officeInbox(user: SessionUser): Promise<InboxItem[]> {
  if (!allowed(user, "officer")) throw new ApplicationError("শুধু কর্মকর্তা দেখতে পারেন।", "Officers only.", 403); // prettier-ignore
  const rows = await getSql()<(Omit<InboxItem, "sla" | "due_on"> & { due_on: Date | null })[]>`
    select a.app_no, a.type, u.name_bn as applicant_bn, a.details->>'mouza_bn' as mouza_bn,
           a.details->>'mouza_en' as mouza_en, (a.details->>'dag_no')::int as dag_no,
           a.details->>'survey' as survey, a.fee_taka,
           (select p.txn_ref from payments p where p.application_id = a.id order by p.id desc limit 1) as paid_ref,
           a.due_on, (a.due_on - bd_today())::int as days_left
    from applications a join users u on u.id = a.applicant_user_id
    where a.status = 'in_review'
    order by a.due_on nulls last, a.id`;
  return rows.map((r) => ({
    ...r,
    due_on: day(r.due_on),
    sla:
      r.days_left == null
        ? "green"
        : r.days_left < 0
          ? "red"
          : r.days_left <= 2
            ? "amber"
            : "green",
  }));
}

/** Officer decision. Approving issues the signed document in the same step. */
export async function decideApplication(
  user: SessionUser,
  appNo: string,
  decision: "approve" | "reject",
  note?: string,
) {
  if (!allowed(user, "officer")) throw new ApplicationError("শুধু কর্মকর্তা সিদ্ধান্ত দিতে পারেন।", "Only an officer can decide.", 403); // prettier-ignore
  if (decision === "reject" && !note?.trim()) {
    throw new ApplicationError("নামঞ্জুরের কারণ লিখুন।", "Write the reason for rejecting.", 400);
  }
  const out = await getSql().begin(async (tx) => {
    const [a] = (await tx`
      select id, type, status, details, applicant_user_id, dag_id from applications
      where app_no = ${appNo} for update`) as unknown as { id: string; type: ApplicationTypeId; status: AppStatus; details: Application["details"]; applicant_user_id: string; dag_id: number }[]; // prettier-ignore
    if (!a) throw new ApplicationError("আবেদনটি পাওয়া যায়নি।", "Application not found.", 404);
    if (a.status !== "in_review") throw new ApplicationError("এই আবেদন এখন সিদ্ধান্তের জন্য অপেক্ষায় নেই।", "This application is not waiting for a decision.", 409); // prettier-ignore
    const def = APPLICATION_TYPES[a.type];

    if (decision === "reject") {
      await tx`update applications set status = 'rejected', updated_at = now(), decided_by = ${user.id},
               decision_note = ${note!.trim()} where id = ${a.id}`;
      await tx`insert into application_events (application_id, actor_role, action, note_bn, note_en)
        values (${a.id}, ${user.role}, 'rejected', ${`নামঞ্জুর: ${note!.trim()}`}, ${`Rejected: ${note!.trim()}`})`; // prettier-ignore
      await notify(tx, a.applicant_user_id, {
        title_bn: `${appNo}: নামঞ্জুর`,
        title_en: `${appNo}: rejected`,
        body_bn: `কারণ: ${note!.trim()}`,
        body_en: `Reason: ${note!.trim()}`,
        link: `/my/applications/${appNo}`,
      });
      return { dag_id: a.dag_id, doc: null };
    }

    // Approve → build and sign the document from the records as they are now.
    const facts = await loadDagFacts(a.details.mouza_en ?? a.details.mouza, a.details.dag_no);
    const k = facts.chain.find((c) => c.survey === a.details.survey);
    if (!k) throw new ApplicationError("এই জরিপের খতিয়ান আর রেকর্ডে নেই।", "That survey's khatian is no longer in the records.", 409); // prettier-ignore
    const doc = signDocument({
      kind: "khatian_copy",
      app_no: appNo,
      mouza_bn: facts.dag.mouza_bn,
      mouza_en: facts.dag.mouza_en,
      jl_no: facts.dag.jl_no,
      dag_no: facts.dag.dag_no,
      survey: k.survey,
      year: k.year,
      khatian_no: k.khatian_no,
      area_dec: k.area_dec,
      owners: k.owners,
      ledger_version: facts.dag.version,
    });
    await tx`insert into issued_documents (id, application_id, kind, code, payload_sha256)
             values (${doc.payload.id}, ${a.id}, ${doc.payload.kind}, ${doc.code}, ${doc.payload_sha256})`; // prettier-ignore
    await tx`update applications set status = 'completed', updated_at = now(), decided_by = ${user.id},
             decision_note = ${note?.trim() || null} where id = ${a.id}`;
    await tx`insert into application_events (application_id, actor_role, action, note_bn, note_en) values
      (${a.id}, ${user.role}, 'approved', 'কর্মকর্তা আবেদন মঞ্জুর করেছেন।', 'An officer approved the application.'),
      (${a.id}, 'system', 'document_issued',
       ${`${def.bn} স্বাক্ষরসহ ইস্যু হয়েছে (খতিয়ান ${bn(k.khatian_no)}); QR দিয়ে যাচাই করা যায়।`},
       ${`${def.en} issued with a signature (khatian ${k.khatian_no}); verifiable by QR.`})`;
    await notify(tx, a.applicant_user_id, {
      title_bn: `${appNo}: ডকুমেন্ট প্রস্তুত`,
      title_en: `${appNo}: document ready`,
      body_bn: `${def.bn} ডাউনলোড বা প্রিন্ট করুন।`,
      body_en: `Download or print your ${def.en.toLowerCase()}.`,
      link: `/my/applications/${appNo}`,
    });
    return { dag_id: a.dag_id, doc };
  });

  await appendAudit({ user, action: "app_decide", dag_id: out.dag_id, detail: { app_no: appNo, decision } }); // prettier-ignore
  if (out.doc) {
    // The "untouched" light on /verify/doc looks for this entry.
    await appendAudit({ user, action: "doc_issue", dag_id: out.dag_id, detail: { app_no: appNo, doc_id: out.doc.payload.id, payload_sha256: out.doc.payload_sha256 } }); // prettier-ignore
  }
  return {
    app_no: appNo,
    status: decision === "approve" ? ("completed" as const) : ("rejected" as const),
    document_id: out.doc?.payload.id ?? null,
  };
}

// ---------------------------------------------------------------- notifications

export interface Notification {
  id: number;
  at: string;
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  link: string | null;
  read: boolean;
}

export async function myNotifications(user: SessionUser, limit = 20) {
  return withUser(user, async (tx) => {
    type Row = Omit<Notification, "at" | "read" | "id"> & { id: string; at: Date; read_at: Date | null }; // prettier-ignore
    const rows = await tx<Row[]>`
      select id, at, title_bn, title_en, body_bn, body_en, link, read_at from notifications
      where user_id = ${user.id} order by id desc limit ${limit}`;
    const [{ n }] = (await tx`select count(*)::int as n from notifications where user_id = ${user.id} and read_at is null`) as unknown as [{ n: number }]; // prettier-ignore
    return {
      unread: n,
      items: rows.map(({ read_at, ...r }) => ({ ...r, id: Number(r.id), at: iso(r.at), read: read_at != null })), // prettier-ignore
    };
  });
}

export async function markNotificationsRead(user: SessionUser) {
  return withUser(user, async (tx) => {
    const r = await tx`update notifications set read_at = now() where user_id = ${user.id} and read_at is null`; // prettier-ignore
    return { marked: r.count };
  });
}

/** Unread notifications, for the dot on the account button (one small query per page). */
export async function unreadCount(user: SessionUser): Promise<number> {
  return withUser(user, async (tx) => {
    const [{ n }] = (await tx`select count(*)::int as n from notifications where user_id = ${user.id} and read_at is null`) as unknown as [{ n: number }]; // prettier-ignore
    return n;
  });
}

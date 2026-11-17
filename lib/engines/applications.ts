import type postgres from "postgres";
import { chargeSandbox, METHOD_LABEL, type PaymentMethod } from "../adapters/payment";
import { withUser } from "../auth/db";
import { allowed, type SessionUser } from "../auth/roles";
import {
  APPLICATION_TYPES,
  applyFee,
  approvalFee,
  CATEGORY_LABEL,
  feeFor,
  summarize,
  type AppDetails,
  type ApplicationTypeId,
  type AppStatus,
  type ComplaintCategory,
  type FeeLine,
  type Survey,
} from "../services/catalog";
import { getSql } from "../sql";
import { appendAudit } from "./audit";
import { slaDays, triageComplaint, URGENT } from "./complaints";
import { signDocument, type DocBody } from "./documents";
import { landTaxReport, markTaxPaid } from "./land-tax";
import { findDag, resolveDag, westernDigits } from "./ledger";
import { loadDagFacts } from "./records";
import { bn } from "./rules";

export type { AppStatus } from "../services/catalog";

// The shared application framework: apply → pay (sandbox) → office review → decision → signed
// document. One state machine for every service type (lib/services/catalog.ts):
//
//   payment_due ──pay──▶ in_review ──hearing──▶ hearing ─┐
//        │                   │                           ├─approve─▶ completed (document issued)
//        │                   └───────────────────────────┤            or final_payment_due ──pay──▶ completed
//        │                                               └─reject──▶ rejected
//        ├──pay (flow "auto", land tax)──▶ completed (dakhila issued at once)
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

const NOT_FOUND = () => new ApplicationError("আবেদনটি পাওয়া যায়নি।", "Application not found.", 404);

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
  details: AppDetails;
  summary_bn: string;
  summary_en: string;
  fee_taka: number;
  fee_lines: FeeLine[];
  /** What is due now (apply fee, or the final fee after approval). */
  amount_due: number;
  submitted_at: string;
  updated_at: string;
  due_on: string | null;
  decision_note: string | null;
  hearing: { on: string; place_bn: string; place_en: string } | null;
  /** The viewer is the applicant (an officer may also open it). */
  applicant_is_me: boolean;
  events: AppEvent[];
  payments: { txn_ref: string; amount_taka: number; method: string; paid_at: string }[];
  documents: AppDocument[];
}

type Tx = postgres.Sql | postgres.TransactionSql;

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : String(d));
const day = (d: Date | string | null) =>
  d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

async function notify(
  tx: Tx,
  userId: string,
  n: { title_bn: string; title_en: string; body_bn: string; body_en: string; link: string },
) {
  await tx`insert into notifications (user_id, title_bn, title_en, body_bn, body_en, link)
           values (${userId}, ${n.title_bn}, ${n.title_en}, ${n.body_bn}, ${n.body_en}, ${n.link})`;
}

async function event(
  tx: Tx,
  appId: string,
  role: string,
  action: string,
  noteBn: string,
  noteEn: string,
) {
  // prettier-ignore
  await tx`insert into application_events (application_id, actor_role, action, note_bn, note_en)
           values (${appId}, ${role}, ${action}, ${noteBn}, ${noteEn})`;
}

// ---------------------------------------------------------------- submit: one preparer per type

export interface SubmitInput {
  // certified copy / land tax / complaint (optional)
  mouza?: string;
  dag_no?: number;
  survey?: Survey;
  delivery?: "online" | "post";
  // mutation
  deed_no?: string;
  // land tax
  owner_id?: number;
  // complaint
  category?: ComplaintCategory;
  text?: string;
  anonymous?: boolean;
}

interface Prepared {
  dag_id: number | null;
  stored: AppDetails;
  sla_days: number;
}

async function prepareCopy(i: SubmitInput): Promise<Prepared> {
  if (!i.mouza || !i.dag_no) throw new ApplicationError("মৌজা ও দাগ নম্বর দিন।", "Give the mouza and dag number.", 400); // prettier-ignore
  const survey = i.survey ?? "BS";
  const dag = await resolveDag(i.mouza, i.dag_no); // DagNotFoundError → 404
  const facts = await loadDagFacts(i.mouza, i.dag_no);
  if (!facts.chain.some((c) => c.survey === survey)) {
    throw new ApplicationError(`এই দাগের ${survey} খতিয়ান রেকর্ডে নেই।`, `There is no ${survey} khatian for this dag in the records.`, 400); // prettier-ignore
  }
  return {
    dag_id: dag.id,
    stored: { mouza: dag.mouza_en, mouza_bn: dag.mouza_bn, mouza_en: dag.mouza_en, dag_no: dag.dag_no, survey, delivery: i.delivery ?? "online" }, // prettier-ignore
    sla_days: APPLICATION_TYPES.certified_copy.sla_days,
  };
}

async function prepareMutation(i: SubmitInput): Promise<Prepared> {
  const deedNo = westernDigits(i.deed_no ?? "").replace(/\s+/g, "");
  if (!/^\d{1,6}\/\d{4}$/.test(deedNo)) throw new ApplicationError("দলিল নম্বর এমন হবে: ৫০০১/২০২৬", "The deed number looks like 5001/2026.", 400); // prettier-ignore
  const sql = getSql();
  type Row = { deed_id: number; dag_id: number; dag_no: number; mouza_bn: string; mouza_en: string; area_dec: number; after: boolean; seller_bn: string; seller_en: string; buyer_bn: string; buyer_en: string; case_no: string | null }; // prettier-ignore
  const [d] = await sql<Row[]>`
    select dd.id as deed_id, dd.dag_id, g.dag_no, m.name_bn as mouza_bn, m.name_en as mouza_en,
           dd.area_dec::float8 as area_dec, dd.after_latest_khatian as after,
           s.name_bn as seller_bn, s.name_en as seller_en, b.name_bn as buyer_bn, b.name_en as buyer_en,
           (select mc.case_no from mutation_cases mc where mc.deed_id = dd.id order by mc.id desc limit 1) as case_no
    from deeds dd join dags g on g.id = dd.dag_id join mouzas m on m.id = g.mouza_id
    join owners s on s.id = dd.seller_owner_id join owners b on b.id = dd.buyer_owner_id
    where dd.deed_no = ${deedNo} and dd.deed_type = 'sale'`;
  if (!d) throw new ApplicationError("এই নম্বরের নিবন্ধিত বিক্রয় দলিল পাওয়া যায়নি।", "No registered sale deed with this number.", 404); // prettier-ignore
  if (!d.after) throw new ApplicationError("এই দলিলের নামজারি আগেই হয়েছে।", "This deed has already been mutated.", 409); // prettier-ignore
  const [open] = await sql<{ app_no: string }[]>`
    select app_no from applications where type = 'mutation' and (details->>'deed_id')::int = ${d.deed_id}
      and status not in ('rejected', 'cancelled')`;
  if (open) throw new ApplicationError(`এই দলিলের নামজারির আবেদন আগেই হয়েছে: ${open.app_no}`, `A mutation application for this deed already exists: ${open.app_no}`, 409); // prettier-ignore
  return {
    dag_id: d.dag_id,
    stored: {
      deed_no: deedNo,
      deed_id: d.deed_id,
      case_no: d.case_no,
      mouza: d.mouza_en,
      mouza_bn: d.mouza_bn,
      mouza_en: d.mouza_en,
      dag_no: d.dag_no,
      area_dec: d.area_dec,
      seller_bn: d.seller_bn,
      seller_en: d.seller_en,
      buyer_bn: d.buyer_bn,
      buyer_en: d.buyer_en,
    },
    sla_days: APPLICATION_TYPES.mutation.sla_days,
  };
}

async function prepareLandTax(i: SubmitInput): Promise<Prepared> {
  if (!i.mouza || !i.dag_no || !i.owner_id) throw new ApplicationError("মৌজা, দাগ ও মালিক বেছে নিন।", "Choose the mouza, dag and holder.", 400); // prettier-ignore
  const r = await landTaxReport(i.mouza, i.dag_no);
  const h = r.holders.find((x) => x.owner_id === i.owner_id);
  if (!h) throw new ApplicationError("এই দাগে এই নামে কোনো মালিক নেই।", "This person does not hold this dag.", 404); // prettier-ignore
  if (h.years_due.length === 0) throw new ApplicationError(`চলতি অর্থবছর (${r.current_fy}) পর্যন্ত কর পরিশোধিত — কিছু বাকি নেই।`, `Paid through the current fiscal year (${r.current_fy}) — nothing is due.`, 409); // prettier-ignore
  return {
    dag_id: r.dag_id,
    stored: {
      mouza: r.mouza_en,
      mouza_bn: r.mouza_bn,
      mouza_en: r.mouza_en,
      dag_no: r.dag_no,
      owner_id: h.owner_id,
      holder_bn: h.name_bn,
      holder_en: h.name_en,
      share_dec: h.share_dec,
      years_due: h.years_due,
      due_tk: h.due_tk,
      through_fy: r.current_fy,
      exempt: h.exempt,
      basis_bn: h.basis_bn,
      basis_en: h.basis_en,
    },
    sla_days: 0,
  };
}

async function prepareComplaint(i: SubmitInput): Promise<Prepared> {
  const text = (i.text ?? "").trim();
  if (text.length < 5) throw new ApplicationError("অভিযোগটি কয়েক শব্দে লিখুন।", "Describe the complaint in a few words.", 400); // prettier-ignore
  const t = triageComplaint(text);
  const category = i.category ?? t.category;
  let place: Pick<AppDetails, "mouza" | "mouza_bn" | "mouza_en" | "dag_no"> = {};
  let dagId: number | null = null;
  const dagNo = i.dag_no ?? t.dag_no;
  if (dagNo) {
    const dag = i.mouza
      ? await resolveDag(i.mouza, dagNo).catch(() => null)
      : await findDag(dagNo).then((m) => (m.length === 1 ? resolveDag(m[0]!.mouza_en, dagNo) : null)).catch(() => null); // prettier-ignore
    if (dag) {
      place = { mouza: dag.mouza_en, mouza_bn: dag.mouza_bn, mouza_en: dag.mouza_en, dag_no: dag.dag_no }; // prettier-ignore
      dagId = dag.id;
    }
  }
  return {
    dag_id: dagId,
    stored: { category, text: text.slice(0, 1000), anonymous: !!i.anonymous, urgent: URGENT.includes(category), amount_tk: t.amount_tk, service: t.service, ...place }, // prettier-ignore
    sla_days: slaDays(category),
  };
}

const PREPARE: Record<ApplicationTypeId, (i: SubmitInput) => Promise<Prepared>> = {
  certified_copy: prepareCopy,
  mutation: prepareMutation,
  land_tax: prepareLandTax,
  complaint: prepareComplaint,
};

export async function submitApplication(
  user: SessionUser,
  type: ApplicationTypeId,
  input: SubmitInput,
): Promise<{
  app_no: string;
  status: AppStatus;
  fee_taka: number;
  fee_lines: FeeLine[];
  document_id: string | null;
}> {
  // prettier-ignore
  const def = APPLICATION_TYPES[type];
  if (!def) throw new ApplicationError("এই সেবা এখনও চালু হয়নি।", "This service is not open yet.", 400); // prettier-ignore
  const p = await PREPARE[type](input);
  const fee_lines = feeFor(type, p.stored as Record<string, unknown>);
  const fee = applyFee(fee_lines);
  // Nothing to pay: review types go straight to the office; auto types finish at once.
  const status: AppStatus = fee > 0 ? "payment_due" : "in_review";
  const sum = summarize(type, p.stored);

  const out = await getSql().begin(async (tx) => {
    const [{ no }] = (await tx`
      select next_app_no(${def.prefix}, extract(year from bd_today())::int) as no`) as unknown as [{ no: string }]; // prettier-ignore
    const [{ id }] = (await tx`
      insert into applications (app_no, type, applicant_user_id, dag_id, status, details, fee_taka, due_on)
      values (${no}, ${type}, ${user.id}, ${p.dag_id}, ${status}, ${tx.json(p.stored as postgres.JSONValue)}, ${fee},
              ${status === "in_review" && def.flow === "review" ? tx`bd_today() + ${p.sla_days}::int` : null})
      returning id`) as unknown as [{ id: string }];
    await event(tx, id, user.role, "submitted", `${def.bn}: আবেদন জমা হয়েছে (${sum.bn})।`, `${def.en}: application submitted (${sum.en}).`); // prettier-ignore
    await notify(tx, user.id, {
      title_bn: `আবেদন ${no} জমা হয়েছে`,
      title_en: `Application ${no} submitted`,
      body_bn: fee > 0 ? `ফি ${bn(fee)} টাকা পরিশোধ করুন।` : type === "complaint" ? `অফিস ${bn(p.sla_days)} দিনের মধ্যে ব্যবস্থা নেবে।` : "অফিস যাচাই শুরু করবে।", // prettier-ignore
      body_en: fee > 0 ? `Please pay the fee of Tk ${fee}.` : type === "complaint" ? `The office will act within ${p.sla_days} days.` : "The office will start the review.", // prettier-ignore
      link: `/my/applications/${no}`,
    });
    // Land tax with nothing to pay (exempt holding): the dakhila is issued straight away.
    const doc = status === "in_review" && def.flow === "auto" ? await finish(tx, { id, app_no: no, type, details: p.stored, applicant_user_id: user.id }, user, null) : null; // prettier-ignore
    return { no, doc };
  });
  await appendAudit({ user, action: "app_submit", dag_id: p.dag_id, detail: { app_no: out.no, type } }); // prettier-ignore
  if (out.doc) await auditDoc(user, p.dag_id, out.no, out.doc);
  return {
    app_no: out.no,
    status: out.doc ? "completed" : status,
    fee_taka: fee,
    fee_lines,
    document_id: out.doc?.payload.id ?? null,
  };
}

// ---------------------------------------------------------------- documents

type AppRow = { id: string; app_no: string; type: ApplicationTypeId; details: AppDetails; applicant_user_id: string }; // prettier-ignore
type Signed = ReturnType<typeof signDocument>;

/**
 * Finish an application: carry out what it asks for (mutation: move the shares; land tax: record
 * the payment), sign its document, mark it completed, tell the applicant. Runs inside the
 * caller's transaction, so a failure leaves nothing half done.
 */
async function finish(
  tx: Tx,
  a: AppRow,
  actor: SessionUser,
  txnRef: string | null,
): Promise<Signed> {
  const d = a.details;
  let body: DocBody;
  let label = APPLICATION_TYPES[a.type];
  if (a.type === "certified_copy") {
    const facts = await loadDagFacts(d.mouza_en ?? d.mouza!, d.dag_no!);
    const k = facts.chain.find((c) => c.survey === d.survey);
    if (!k) throw new ApplicationError("এই জরিপের খতিয়ান আর রেকর্ডে নেই।", "That survey's khatian is no longer in the records.", 409); // prettier-ignore
    body = { kind: "khatian_copy", app_no: a.app_no, mouza_bn: facts.dag.mouza_bn, mouza_en: facts.dag.mouza_en, jl_no: facts.dag.jl_no, dag_no: facts.dag.dag_no, survey: k.survey, year: k.year, khatian_no: k.khatian_no, area_dec: k.area_dec, owners: k.owners, ledger_version: facts.dag.version }; // prettier-ignore
  } else if (a.type === "mutation") {
    const [{ r }] = (await tx`select approve_mutation(${d.deed_id!}) as r`) as unknown as [{ r: { ok: boolean; reason_bn?: string; reason_en?: string; khatian_no?: number; case_no?: string; version?: number } }]; // prettier-ignore
    if (!r.ok) throw new ApplicationError(r.reason_bn ?? "নামজারি করা যায়নি।", r.reason_en ?? "The mutation could not be carried out.", 409); // prettier-ignore
    const dag = await resolveDagTx(tx, d.mouza_en!, d.dag_no!);
    body = { kind: "mutation_khatian", app_no: a.app_no, mouza_bn: d.mouza_bn!, mouza_en: d.mouza_en!, jl_no: dag.jl_no, dag_no: d.dag_no!, survey: "BS", year: Number(new Date().getUTCFullYear()), khatian_no: r.khatian_no!, area_dec: d.area_dec!, owners: [{ name_bn: d.buyer_bn!, name_en: d.buyer_en!, share_dec: d.area_dec! }], deed_no: d.deed_no, case_no: r.case_no ?? d.case_no ?? null, ledger_version: r.version! }; // prettier-ignore
    await tx`update applications set details = details || ${tx.json({ new_khatian_no: r.khatian_no! })} where id = ${a.id}`; // prettier-ignore
  } else if (a.type === "land_tax") {
    const dag = await resolveDagTx(tx, d.mouza_en!, d.dag_no!);
    await markTaxPaid(tx, dag.id, d.owner_id!, d.through_fy!);
    body = { kind: "dakhila", app_no: a.app_no, mouza_bn: d.mouza_bn!, mouza_en: d.mouza_en!, jl_no: dag.jl_no, dag_no: d.dag_no!, owner_id: d.owner_id!, holder_bn: d.holder_bn!, holder_en: d.holder_en!, share_dec: d.share_dec!, years: d.years_due ?? [], through_fy: d.through_fy!, amount_tk: d.due_tk ?? 0, exempt: !!d.exempt, txn_ref: txnRef, ledger_version: dag.version }; // prettier-ignore
  } else {
    throw new ApplicationError("এই সেবায় কোনো ডকুমেন্ট নেই।", "This service issues no document.", 400); // prettier-ignore
  }
  const doc = signDocument(body);
  label = APPLICATION_TYPES[a.type];
  await tx`insert into issued_documents (id, application_id, kind, code, payload_sha256)
           values (${doc.payload.id}, ${a.id}, ${doc.payload.kind}, ${doc.code}, ${doc.payload_sha256})`; // prettier-ignore
  await tx`update applications set status = 'completed', updated_at = now() where id = ${a.id}`;
  const what =
    doc.payload.kind === "dakhila"
      ? { bn: `দাখিলা ইস্যু হয়েছে (${doc.payload.through_fy} পর্যন্ত)`, en: `Dakhila issued (through ${doc.payload.through_fy})` } // prettier-ignore
      : doc.payload.kind === "mutation_khatian"
        ? { bn: `নামজারি সম্পন্ন: নতুন বিএস খতিয়ান নং ${bn(doc.payload.khatian_no)}, শেয়ার লেজারে অংশ বদলেছে`, en: `Mutation done: new BS khatian no. ${doc.payload.khatian_no}; shares moved in the ledger` } // prettier-ignore
        : { bn: `${label.bn} স্বাক্ষরসহ ইস্যু হয়েছে (খতিয়ান ${bn(doc.payload.khatian_no)})`, en: `${label.en} issued with a signature (khatian ${doc.payload.khatian_no})` }; // prettier-ignore
  await event(tx, a.id, "system", "document_issued", `${what.bn}; QR দিয়ে যাচাই করা যায়।`, `${what.en}; verifiable by QR.`); // prettier-ignore
  await notify(tx, a.applicant_user_id, {
    title_bn: `${a.app_no}: ডকুমেন্ট প্রস্তুত`,
    title_en: `${a.app_no}: document ready`,
    body_bn: `${what.bn}। ডাউনলোড বা প্রিন্ট করুন।`,
    body_en: `${what.en}. Download or print it.`,
    link: `/my/applications/${a.app_no}`,
  });
  void actor;
  return doc;
}

/** resolveDag through the same transaction (sees rows the transaction just changed). */
async function resolveDagTx(tx: Tx, mouzaEn: string, dagNo: number) {
  const [r] = (await tx`
    select d.id, m.jl_no, d.ledger_version as version from dags d join mouzas m on m.id = d.mouza_id
    where m.name_en = ${mouzaEn} and d.dag_no = ${dagNo}`) as unknown as { id: number; jl_no: number; version: number }[]; // prettier-ignore
  if (!r) throw new ApplicationError("দাগটি রেকর্ডে পাওয়া যায়নি।", "Dag not found.", 404);
  return r;
}

/** The "untouched" light on /verify/doc looks for this audit entry. */
async function auditDoc(user: SessionUser, dagId: number | null, appNo: string, doc: Signed) {
  await appendAudit({ user, action: "doc_issue", dag_id: dagId, detail: { app_no: appNo, doc_id: doc.payload.id, payload_sha256: doc.payload_sha256 } }); // prettier-ignore
}

// ---------------------------------------------------------------- read

/** One application with its timeline, payments and documents; null if this user may not see it. */
export async function getApplication(
  user: SessionUser,
  appNo: string,
): Promise<Application | null> {
  return withUser(user, async (tx) => {
    type Row = { id: string; app_no: string; type: ApplicationTypeId; status: AppStatus; details: AppDetails; fee_taka: number; submitted_at: Date; updated_at: Date; due_on: Date | null; decision_note: string | null; mine: boolean }; // prettier-ignore
    const [a] = await tx<Row[]>`
      select id, app_no, type, status, details, fee_taka, submitted_at, updated_at, due_on, decision_note,
             applicant_user_id = ${user.id} as mine
      from applications where app_no = ${appNo}`;
    if (!a) return null;
    const [events, payments, documents, hearings] = await Promise.all([
      tx<(AppEvent & { at: Date })[]>`
        select at, actor_role, action, note_bn, note_en from application_events
        where application_id = ${a.id} order by id`,
      tx<{ txn_ref: string; amount_taka: number; method: string; paid_at: Date }[]>`
        select txn_ref, amount_taka, method, paid_at from payments where application_id = ${a.id} order by id`, // prettier-ignore
      tx<(AppDocument & { issued_at: Date })[]>`
        select id, kind, code, issued_at, revoked from issued_documents where application_id = ${a.id} order by issued_at`, // prettier-ignore
      tx<{ hearing_on: Date; place_bn: string; place_en: string }[]>`
        select hearing_on, place_bn, place_en from hearings where application_id = ${a.id} order by id desc limit 1`, // prettier-ignore
    ]);
    const lines = feeFor(a.type, a.details as Record<string, unknown>);
    const sum = summarize(a.type, a.details);
    const h = hearings[0];
    return {
      app_no: a.app_no,
      type: a.type,
      status: a.status,
      details: a.details,
      summary_bn: sum.bn,
      summary_en: sum.en,
      fee_taka: a.fee_taka,
      fee_lines: lines,
      amount_due: a.status === "payment_due" ? a.fee_taka : a.status === "final_payment_due" ? approvalFee(lines) : 0, // prettier-ignore
      submitted_at: iso(a.submitted_at),
      updated_at: iso(a.updated_at),
      due_on: day(a.due_on),
      decision_note: a.decision_note,
      hearing: h ? { on: day(h.hearing_on)!, place_bn: h.place_bn, place_en: h.place_en } : null,
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
  summary_bn: string;
  summary_en: string;
  fee_taka: number;
  submitted_at: string;
  updated_at: string;
  due_on: string | null;
  has_document: boolean;
}

/** The signed-in citizen's own applications, newest first (RLS: only theirs). */
export async function myApplications(user: SessionUser, limit = 50): Promise<AppSummary[]> {
  return withUser(user, async (tx) => {
    type Row = { app_no: string; type: ApplicationTypeId; status: AppStatus; details: AppDetails; fee_taka: number; submitted_at: Date; updated_at: Date; due_on: Date | null; has_document: boolean }; // prettier-ignore
    const rows = await tx<Row[]>`
      select a.app_no, a.type, a.status, a.details, a.fee_taka, a.submitted_at, a.updated_at, a.due_on,
             exists (select 1 from issued_documents d where d.application_id = a.id and not d.revoked) as has_document
      from applications a where a.applicant_user_id = ${user.id}
      order by a.id desc limit ${limit}`;
    return rows.map(({ details, ...r }) => {
      const s = summarize(r.type, details);
      return { ...r, summary_bn: s.bn, summary_en: s.en, submitted_at: iso(r.submitted_at), updated_at: iso(r.updated_at), due_on: day(r.due_on) }; // prettier-ignore
    });
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
    type: a.type,
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
      select id, app_no, type, status, fee_taka, details, applicant_user_id, dag_id from applications
      where app_no = ${appNo} for update`) as unknown as (AppRow & { status: AppStatus; fee_taka: number; dag_id: number | null })[]; // prettier-ignore
    // Not yours = not found (no hint that the number exists).
    if (!a || a.applicant_user_id !== user.id) throw NOT_FOUND();
    if (a.status !== "payment_due" && a.status !== "final_payment_due") {
      throw new ApplicationError("এই আবেদনে এখন কোনো ফি বাকি নেই।", "No fee is due on this application now.", 409); // prettier-ignore
    }
    const def = APPLICATION_TYPES[a.type];
    const final = a.status === "final_payment_due";
    const amount = final ? approvalFee(feeFor(a.type, a.details as Record<string, unknown>)) : a.fee_taka; // prettier-ignore
    const receipt = chargeSandbox(amount, method);
    await tx`insert into payments (application_id, amount_taka, method, txn_ref, status)
             values (${a.id}, ${receipt.amount_taka}, ${method}, ${receipt.txn_ref}, 'paid')`;
    const label = METHOD_LABEL[method];
    const paidBn = `${final ? "শেষ ফি" : "ফি"} ${bn(receipt.amount_taka)} টাকা পরিশোধ (${label.bn}, রসিদ ${receipt.txn_ref})।`; // prettier-ignore
    const paidEn = `${final ? "Final fee" : "Fee"} of Tk ${receipt.amount_taka} paid (${label.en}, receipt ${receipt.txn_ref}).`; // prettier-ignore

    if (final || def.flow === "auto") {
      await event(tx, a.id, user.role, "paid", paidBn, paidEn);
      const doc = await finish(tx, a, user, receipt.txn_ref);
      return { dag_id: a.dag_id, receipt, due_on: null as string | null, status: "completed" as AppStatus, doc }; // prettier-ignore
    }
    const [{ due }] = (await tx`
      update applications set status = 'in_review', updated_at = now(), due_on = bd_today() + ${def.sla_days}::int
      where id = ${a.id} returning due_on as due`) as unknown as [{ due: Date }];
    await event(tx, a.id, user.role, "paid", `${paidBn} অফিস যাচাই শুরু করেছে।`, `${paidEn} The office review has started.`); // prettier-ignore
    await notify(tx, user.id, {
      title_bn: `${appNo}: ফি পরিশোধ হয়েছে`,
      title_en: `${appNo}: fee paid`,
      body_bn: `রসিদ ${receipt.txn_ref}। সিদ্ধান্তের শেষ তারিখ ${bn(day(due)!)}।`,
      body_en: `Receipt ${receipt.txn_ref}. Decision due by ${day(due)}.`,
      link: `/my/applications/${appNo}`,
    });
    return { dag_id: a.dag_id, receipt, due_on: day(due), status: "in_review" as AppStatus, doc: null }; // prettier-ignore
  });
  await appendAudit({ user, action: "app_pay", dag_id: result.dag_id, detail: { app_no: appNo, txn_ref: result.receipt.txn_ref, amount_taka: result.receipt.amount_taka } }); // prettier-ignore
  if (result.doc) await auditDoc(user, result.dag_id, appNo, result.doc);
  const { txn_ref, amount_taka, method: paid_with, sandbox } = result.receipt;
  return { app_no: appNo, status: result.status, txn_ref, amount_taka, method: paid_with, sandbox, due_on: result.due_on, document_id: result.doc?.payload.id ?? null }; // prettier-ignore
}

export async function cancelApplication(user: SessionUser, appNo: string) {
  await getSql().begin(async (tx) => {
    const [a] = (await tx`select id, status, applicant_user_id from applications where app_no = ${appNo} for update`) as unknown as { id: string; status: AppStatus; applicant_user_id: string }[]; // prettier-ignore
    if (!a || a.applicant_user_id !== user.id) throw NOT_FOUND();
    if (a.status !== "payment_due") throw new ApplicationError("ফি পরিশোধের পর আবেদন বাতিল করা যায় না।", "An application cannot be cancelled after payment.", 409); // prettier-ignore
    await tx`update applications set status = 'cancelled', updated_at = now() where id = ${a.id}`;
    await event(tx, a.id, user.role, "cancelled", "আবেদনকারী আবেদনটি বাতিল করেছেন।", "The applicant cancelled the application."); // prettier-ignore
  });
  return { app_no: appNo, status: "cancelled" as const };
}

// ---------------------------------------------------------------- office

export interface InboxItem {
  app_no: string;
  type: ApplicationTypeId;
  status: AppStatus;
  applicant_bn: string;
  summary_bn: string;
  summary_en: string;
  /** Complaint text (shown to the officer only). */
  text: string | null;
  urgent: boolean;
  fee_taka: number;
  paid_ref: string | null;
  hearing_on: string | null;
  due_on: string | null;
  /** green: more than 2 days left · amber: 0–2 days · red: overdue */
  sla: "green" | "amber" | "red";
  days_left: number | null;
  can_hear: boolean;
}

/** Applications waiting for an officer, the most urgent first. */
export async function officeInbox(user: SessionUser): Promise<InboxItem[]> {
  if (!allowed(user, "officer")) throw new ApplicationError("শুধু কর্মকর্তা দেখতে পারেন।", "Officers only.", 403); // prettier-ignore
  type Row = { app_no: string; type: ApplicationTypeId; status: AppStatus; applicant_bn: string; details: AppDetails; fee_taka: number; paid_ref: string | null; hearing_on: Date | null; due_on: Date | null; days_left: number | null }; // prettier-ignore
  const rows = await getSql()<Row[]>`
    select a.app_no, a.type, a.status, u.name_bn as applicant_bn, a.details, a.fee_taka,
           (select p.txn_ref from payments p where p.application_id = a.id order by p.id desc limit 1) as paid_ref,
           (select h.hearing_on from hearings h where h.application_id = a.id order by h.id desc limit 1) as hearing_on,
           a.due_on, (a.due_on - bd_today())::int as days_left
    from applications a join users u on u.id = a.applicant_user_id
    where a.status in ('in_review', 'hearing')
    order by (a.details->>'urgent')::boolean is true desc, a.due_on nulls last, a.id`;
  return rows.map(({ details: d, ...r }) => {
    const s = summarize(r.type, d);
    return {
      ...r,
      // An anonymous complaint never shows who filed it, not even to the office.
      applicant_bn: d.anonymous ? "বেনামি / Anonymous" : r.applicant_bn,
      summary_bn: s.bn,
      summary_en: s.en,
      text: d.text ?? null,
      urgent: !!d.urgent,
      hearing_on: day(r.hearing_on),
      due_on: day(r.due_on),
      sla: r.days_left == null ? "green" : r.days_left < 0 ? "red" : r.days_left <= 2 ? "amber" : "green", // prettier-ignore
      can_hear: !!APPLICATION_TYPES[r.type]?.hearing && r.status === "in_review",
    };
  });
}

const HEARING_PLACE = {
  bn: "সহকারী কমিশনার (ভূমি) অফিস, ডেমো উপজেলা (কাল্পনিক)",
  en: "AC Land office, demo upazila (fictional)",
};

/** Officer calls a hearing (mutation): notice to the applicant and SMS to both deed parties. */
export async function scheduleHearing(user: SessionUser, appNo: string, onDate?: string) {
  if (!allowed(user, "officer")) throw new ApplicationError("শুধু কর্মকর্তা শুনানি ডাকতে পারেন।", "Only an officer can call a hearing.", 403); // prettier-ignore
  const out = await getSql().begin(async (tx) => {
    const [a] = (await tx`select id, app_no, type, status, details, applicant_user_id, dag_id from applications where app_no = ${appNo} for update`) as unknown as (AppRow & { status: AppStatus; dag_id: number | null })[]; // prettier-ignore
    if (!a) throw NOT_FOUND();
    if (!APPLICATION_TYPES[a.type].hearing || a.status !== "in_review") throw new ApplicationError("এই আবেদনে এখন শুনানি ডাকা যায় না।", "A hearing cannot be called for this application now.", 409); // prettier-ignore
    const [{ on }] = (await tx`select coalesce(${onDate ?? null}::date, bd_today() + 7) as on`) as unknown as [{ on: Date }]; // prettier-ignore
    const date = day(on)!;
    await tx`insert into hearings (application_id, hearing_on, place_bn, place_en)
             values (${a.id}, ${date}, ${HEARING_PLACE.bn}, ${HEARING_PLACE.en})`;
    await tx`update applications set status = 'hearing', updated_at = now() where id = ${a.id}`;
    await event(tx, a.id, user.role, "hearing", `শুনানি ${bn(date)} তারিখে, ${HEARING_PLACE.bn}। উভয় পক্ষকে নোটিশ (এসএমএস) পাঠানো হয়েছে।`, `Hearing on ${date} at the ${HEARING_PLACE.en}. Both parties were sent a notice (SMS).`); // prettier-ignore
    if (a.details.deed_id) {
      const body = `ভূমিসাথী: নামজারি ${appNo}-এর শুনানি ${bn(date)} তারিখে ${HEARING_PLACE.bn}-এ। দলিল ও পরিচয়পত্র নিয়ে আসুন।`; // prettier-ignore
      await tx`select sms_to(dd.seller_owner_id, ${body}, null), sms_to(dd.buyer_owner_id, ${body}, null)
               from deeds dd where dd.id = ${a.details.deed_id}`;
    }
    await notify(tx, a.applicant_user_id, {
      title_bn: `${appNo}: শুনানির নোটিশ`,
      title_en: `${appNo}: hearing notice`,
      body_bn: `শুনানি ${bn(date)}, ${HEARING_PLACE.bn}।`,
      body_en: `Hearing on ${date}, ${HEARING_PLACE.en}.`,
      link: `/my/applications/${appNo}`,
    });
    return { dag_id: a.dag_id, date };
  });
  await appendAudit({ user, action: "app_hearing", dag_id: out.dag_id, detail: { app_no: appNo, hearing_on: out.date } }); // prettier-ignore
  return { app_no: appNo, status: "hearing" as const, hearing_on: out.date };
}

/**
 * Officer decision.
 *   certified copy: approve issues the signed copy at once.
 *   mutation:       approve = the AC Land's order; the DCR fee is then due, and paying it moves
 *                   the shares and issues the new khatian.
 *   complaint:      approve = resolved (what was done is required and shown to the citizen).
 */
export async function decideApplication(
  user: SessionUser,
  appNo: string,
  decision: "approve" | "reject",
  note?: string,
) {
  if (!allowed(user, "officer")) throw new ApplicationError("শুধু কর্মকর্তা সিদ্ধান্ত দিতে পারেন।", "Only an officer can decide.", 403); // prettier-ignore
  const text = note?.trim() ?? "";
  const out = await getSql().begin(async (tx) => {
    const [a] = (await tx`
      select id, app_no, type, status, details, applicant_user_id, dag_id from applications
      where app_no = ${appNo} for update`) as unknown as (AppRow & { status: AppStatus; dag_id: number | null })[]; // prettier-ignore
    if (!a) throw NOT_FOUND();
    if (a.status !== "in_review" && a.status !== "hearing") throw new ApplicationError("এই আবেদন এখন সিদ্ধান্তের জন্য অপেক্ষায় নেই।", "This application is not waiting for a decision.", 409); // prettier-ignore
    const isComplaint = a.type === "complaint";
    if ((decision === "reject" || isComplaint) && !text) {
      throw new ApplicationError(isComplaint ? "কী ব্যবস্থা নেওয়া হয়েছে তা লিখুন।" : "নামঞ্জুরের কারণ লিখুন।", isComplaint ? "Write what was done." : "Write the reason for rejecting.", 400); // prettier-ignore
    }
    await tx`update applications set decided_by = ${user.id}, decision_note = ${text || null}, updated_at = now() where id = ${a.id}`; // prettier-ignore

    if (decision === "reject") {
      await tx`update applications set status = 'rejected' where id = ${a.id}`;
      await event(tx, a.id, user.role, "rejected", `${isComplaint ? "বন্ধ" : "নামঞ্জুর"}: ${text}`, `${isComplaint ? "Closed" : "Rejected"}: ${text}`); // prettier-ignore
      await notify(tx, a.applicant_user_id, { title_bn: `${appNo}: ${isComplaint ? "বন্ধ" : "নামঞ্জুর"}`, title_en: `${appNo}: ${isComplaint ? "closed" : "rejected"}`, body_bn: `কারণ: ${text}`, body_en: `Reason: ${text}`, link: `/my/applications/${appNo}` }); // prettier-ignore
      return { dag_id: a.dag_id, doc: null, status: "rejected" as AppStatus };
    }
    if (isComplaint) {
      await tx`update applications set status = 'completed' where id = ${a.id}`;
      await event(tx, a.id, user.role, "resolved", `নিষ্পত্তি: ${text}`, `Resolved: ${text}`);
      await notify(tx, a.applicant_user_id, { title_bn: `${appNo}: অভিযোগ নিষ্পত্তি হয়েছে`, title_en: `${appNo}: complaint resolved`, body_bn: text, body_en: text, link: `/my/applications/${appNo}` }); // prettier-ignore
      return { dag_id: a.dag_id, doc: null, status: "completed" as AppStatus };
    }
    if (a.type === "mutation") {
      const due = approvalFee(feeFor(a.type, a.details as Record<string, unknown>));
      await tx`update applications set status = 'final_payment_due' where id = ${a.id}`;
      await event(tx, a.id, user.role, "approved", `এসি ল্যান্ড নামজারি অনুমোদন করেছেন। ডিসিআর ফি ${bn(due)} টাকা পরিশোধ করলে নতুন খতিয়ান হবে।`, `The AC Land approved the mutation. Pay the DCR fee of Tk ${due} to get the new khatian.`); // prettier-ignore
      await notify(tx, a.applicant_user_id, { title_bn: `${appNo}: নামজারি অনুমোদিত`, title_en: `${appNo}: mutation approved`, body_bn: `ডিসিআর ফি ${bn(due)} টাকা পরিশোধ করুন।`, body_en: `Pay the DCR fee of Tk ${due}.`, link: `/my/applications/${appNo}` }); // prettier-ignore
      return { dag_id: a.dag_id, doc: null, status: "final_payment_due" as AppStatus };
    }
    await event(tx, a.id, user.role, "approved", "কর্মকর্তা আবেদন মঞ্জুর করেছেন।", "An officer approved the application."); // prettier-ignore
    const doc = await finish(tx, a, user, null);
    return { dag_id: a.dag_id, doc, status: "completed" as AppStatus };
  });

  await appendAudit({ user, action: "app_decide", dag_id: out.dag_id, detail: { app_no: appNo, decision } }); // prettier-ignore
  if (out.doc) await auditDoc(user, out.dag_id, appNo, out.doc);
  return { app_no: appNo, status: out.status, document_id: out.doc?.payload.id ?? null };
}

export { CATEGORY_LABEL };

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

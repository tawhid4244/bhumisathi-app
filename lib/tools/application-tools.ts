import QRCode from "qrcode";
import { z } from "zod";
import { PAYMENT_METHODS } from "../adapters/payment";
import {
  cancelApplication,
  decideApplication,
  getApplication,
  markNotificationsRead,
  myApplications,
  myNotifications,
  officeInbox,
  payApplication,
  scheduleHearing,
  submitApplication,
  trackApplication,
} from "../engines/applications";
import { complaintStats } from "../engines/complaints";
import { verifyDocument } from "../engines/documents";
import { holdingsOf, landTaxReport } from "../engines/land-tax";
import { COMPLAINT_CATEGORIES, SURVEYS } from "../services/catalog";
import { dagRef, mouzaFor } from "./ledger-tools";
import { siteUrl } from "./seal-tools";
import { defineTool, type ToolContext } from "./types";

// The application framework as tools (lib/engines/applications.ts). Pages, the API and Sathi AI
// use the same ones. Writes (submit, pay, cancel, decide) are hidden from the AI in Phase B: the
// citizen does them in the app with their own clicks.

const appNo = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}-\d{4}-\d{4,6}$/, "Application number like CPY-2026-0001")
  .describe("Application number, e.g. CPY-2026-0001");

/** These tools are for signed-in people; runTool already checked the role. */
function who(ctx: ToolContext) {
  if (!ctx.user) throw new Error("A signed-in user is required.");
  return ctx.user;
}

const copyDetails = z.object({
  mouza: dagRef.shape.mouza,
  dag_no: dagRef.shape.dag_no,
  survey: z.enum(SURVEYS).default("BS"),
  delivery: z.enum(["online", "post"]).default("online"),
});

const complaintDetails = z.object({
  category: z.enum(COMPLAINT_CATEGORIES).optional().describe("Leave out to let triage choose"),
  text: z.string().trim().min(5).max(1000).describe("The complaint in the citizen's own words"),
  mouza: dagRef.shape.mouza.optional(),
  dag_no: dagRef.shape.dag_no.optional(),
  anonymous: z.boolean().default(false),
});

/** Each service type has its own details; the type picks which. */
/** Each service type has its own details; checked against the type's schema in the handler. */
const DETAILS = {
  certified_copy: copyDetails,
  mutation: z.object({ deed_no: z.string().trim().min(6).max(20).describe("e.g. 5001/2026") }),
  land_tax: z.object({
    mouza: dagRef.shape.mouza,
    dag_no: dagRef.shape.dag_no,
    owner_id: z.number().int().positive(),
  }),
  complaint: complaintDetails,
} as const;

// One object schema (model tool schemas must be objects; a union is not).
const submitInput = z.object({
  type: z.enum(["certified_copy", "mutation", "land_tax", "complaint"]),
  details: z.record(z.string(), z.unknown()),
});

const feeLine = z.object({
  bn: z.string(),
  en: z.string(),
  tk: z.number(),
  stage: z.enum(["apply", "approval"]).optional(),
});

const submitOutput = z.object({
  app_no: z.string(),
  status: z.string(),
  fee_taka: z.number(),
  fee_lines: z.array(feeLine),
  document_id: z.string().nullable(),
});

export const applicationSubmitTool = defineTool({
  name: "application_submit",
  kind: "write",
  access: "citizen",
  hiddenFromAgent: true,
  description: {
    bn: "নতুন আবেদন জমা: খতিয়ানের সার্টিফাইড কপি, নামজারি, ভূমি উন্নয়ন কর বা অভিযোগ।",
    en: "Submits a new application: certified khatian copy, mutation, land tax or complaint.",
  },
  input: submitInput,
  output: submitOutput,
  handler: async (i, ctx) => submitApplication(who(ctx), i.type, DETAILS[i.type].parse(i.details)), // ZodError → 400
});

/**
 * The one write Sathi AI may propose for a citizen: filing a complaint. Like every write it
 * stops at a confirmation card; nothing is filed until the citizen presses Yes.
 */
export const complaintSubmitTool = defineTool({
  name: "complaint_submit",
  kind: "write",
  access: "citizen",
  description: {
    bn: "নাগরিকের অভিযোগ দাখিল (দালাল, বাড়তি টাকা/ঘুষ, দেরি, ভুল রেকর্ড, কারিগরি সমস্যা)। নাগরিক স্পষ্টভাবে অভিযোগ করতে চাইলে ব্যবহার করুন।",
    en: "Files the citizen's complaint (broker, extra money/bribe, delay, wrong record, technical). Use when they clearly want to report something.",
  },
  input: complaintDetails,
  output: submitOutput,
  handler: async (i, ctx) => submitApplication(who(ctx), "complaint", i),
  audit: () => null, // submitApplication writes its own audit entry
});

export const applicationHearingTool = defineTool({
  name: "application_hearing",
  kind: "write",
  access: "officer",
  hiddenFromAgent: true,
  description: {
    bn: "নামজারির শুনানি নির্ধারণ; উভয় পক্ষকে নোটিশ (মক এসএমএস)।",
    en: "Calls a mutation hearing; both parties get a notice (mock SMS).",
  },
  input: z.object({ app_no: appNo, on: z.string().date().optional() }),
  output: z.object({ app_no: z.string(), status: z.string(), hearing_on: z.string() }),
  handler: async (i, ctx) => scheduleHearing(who(ctx), i.app_no, i.on),
});

const taxLine = z.object({
  owner_id: z.number(),
  name_bn: z.string(),
  name_en: z.string(),
  share_dec: z.number(),
  agricultural: z.boolean(),
  family_agri_dec: z.number(),
  exempt: z.boolean(),
  rate_tk_per_dec: z.number(),
  annual_tk: z.number(),
  paid_through_fy: z.string(),
  years_due: z.array(z.string()),
  due_tk: z.number(),
  basis_bn: z.string(),
  basis_en: z.string(),
});

export const landTaxDueTool = defineTool({
  name: "land_tax_due",
  kind: "read",
  description: {
    bn: "ভূমি উন্নয়ন কর: দাগের প্রতিটি মালিকের কত অর্থবছর বাকি ও কত টাকা (নিয়ম ও সূত্রসহ)। দাগ না দিলে লগইন করা নাগরিকের নিজের জমি। 'আমার খাজনা কত বাকি?'",
    en: "Land development tax: unpaid fiscal years and amount for each holder of a dag (with rules and sources). Without a dag: the signed-in citizen's own holdings. 'How much land tax do I owe?'",
  },
  input: z.object({
    mouza: dagRef.shape.mouza.optional(),
    dag_no: dagRef.shape.dag_no.optional(),
  }),
  output: z.object({
    reports: z.array(
      z.object({
        mouza_bn: z.string(),
        mouza_en: z.string(),
        dag_no: z.number(),
        dag_id: z.number(),
        land_class_bn: z.string(),
        land_class_en: z.string(),
        current_fy: z.string(),
        holders: z.array(taxLine),
        note_bn: z.string(),
        note_en: z.string(),
        source: z.string(),
        verified: z.string(),
      }),
    ),
    linked: z.boolean(),
  }),
  handler: async (i, ctx) => {
    if (i.dag_no) {
      return { reports: [await landTaxReport(await mouzaFor(i.mouza, i.dag_no), i.dag_no)], linked: true }; // prettier-ignore
    }
    const ownerId = ctx.user?.owner_id;
    if (!ownerId) return { reports: [], linked: false };
    const holdings = await holdingsOf(ownerId);
    const reports = await Promise.all(holdings.map((h) => landTaxReport(h.mouza_en, h.dag_no)));
    // Only this citizen's own line on each dag.
    return { reports: reports.map((r) => ({ ...r, holders: r.holders.filter((x) => x.owner_id === ownerId) })), linked: true }; // prettier-ignore
  },
});

export const complaintStatsTool = defineTool({
  name: "complaint_stats",
  kind: "read",
  hiddenFromAgent: true,
  description: { bn: "এই মাসের অভিযোগের পরিসংখ্যান (শুধু সংখ্যা)।", en: "This month's complaint statistics (counts only)." }, // prettier-ignore
  input: z.object({}),
  output: z.object({
    month: z.string(),
    total: z.number(),
    resolved: z.number(),
    open: z.number(),
    by_category: z.array(z.object({ category: z.string(), bn: z.string(), en: z.string(), n: z.number() })), // prettier-ignore
    on_time_pct: z.number().nullable(),
  }),
  handler: async () => complaintStats(),
});

const event = z.object({
  at: z.string(),
  actor_role: z.string(),
  action: z.string(),
  note_bn: z.string(),
  note_en: z.string(),
});

export const applicationStatusTool = defineTool({
  name: "application_status",
  kind: "read",
  access: "citizen",
  description: {
    bn: "নাগরিকের নিজের আবেদনগুলোর অবস্থা (নম্বর দিলে সেটির পুরো সময়রেখা)। 'আমার আবেদন কোথায়?'",
    en: "The signed-in citizen's own applications (with a number: that one's full timeline). 'Where is my application?'",
  },
  input: z.object({ app_no: appNo.optional() }),
  output: z.object({
    applications: z.array(
      z.object({
        app_no: z.string(),
        type: z.string(),
        status: z.string(),
        summary_bn: z.string(),
        summary_en: z.string(),
        fee_taka: z.number(),
        submitted_at: z.string(),
        updated_at: z.string(),
        due_on: z.string().nullable(),
        has_document: z.boolean(),
      }),
    ),
    detail: z
      .object({
        app_no: z.string(),
        status: z.string(),
        due_on: z.string().nullable(),
        decision_note: z.string().nullable(),
        events: z.array(event),
      })
      .nullable(),
  }),
  handler: async (i, ctx) => {
    const user = who(ctx);
    const applications = await myApplications(user, 20);
    const one = i.app_no ? await getApplication(user, i.app_no) : null;
    return {
      applications,
      detail: one
        ? { app_no: one.app_no, status: one.status, due_on: one.due_on, decision_note: one.decision_note, events: one.events } // prettier-ignore
        : null,
    };
  },
});

export const applicationTrackTool = defineTool({
  name: "application_track",
  kind: "read",
  description: {
    bn: "আবেদন নম্বর দিয়ে অবস্থা দেখুন (লগইন ছাড়া; নাম বা জমির তথ্য দেখায় না)।",
    en: "Track an application by number (no sign-in; shows no names or land details).",
  },
  input: z.object({ app_no: appNo }),
  output: z
    .object({
      app_no: z.string(),
      type: z.string(),
      type_bn: z.string(),
      type_en: z.string(),
      status: z.string(),
      submitted_on: z.string(),
      updated_on: z.string(),
      due_on: z.string().nullable(),
    })
    .nullable(),
  handler: async (i) => trackApplication(i.app_no),
});

export const applicationPayTool = defineTool({
  name: "application_pay",
  kind: "write",
  access: "citizen",
  hiddenFromAgent: true,
  description: {
    bn: "আবেদনের ফি পরিশোধ — শুধু পরীক্ষামূলক (sandbox), কোনো আসল টাকা নয়।",
    en: "Pays an application's fee — SANDBOX only, no real money.",
  },
  input: z.object({ app_no: appNo, method: z.enum(PAYMENT_METHODS) }),
  output: z.object({
    app_no: z.string(),
    status: z.string(),
    txn_ref: z.string(),
    amount_taka: z.number(),
    method: z.string(),
    sandbox: z.literal(true),
    due_on: z.string().nullable(),
    document_id: z.string().nullable(),
  }),
  handler: async (i, ctx) => payApplication(who(ctx), i.app_no, i.method),
});

export const applicationCancelTool = defineTool({
  name: "application_cancel",
  kind: "write",
  access: "citizen",
  hiddenFromAgent: true,
  description: { bn: "ফি পরিশোধের আগে আবেদন বাতিল।", en: "Cancels an application before payment." },
  input: z.object({ app_no: appNo }),
  output: z.object({ app_no: z.string(), status: z.string() }),
  handler: async (i, ctx) => cancelApplication(who(ctx), i.app_no),
});

export const applicationInboxTool = defineTool({
  name: "application_inbox",
  kind: "read",
  access: "officer",
  hiddenFromAgent: true,
  description: {
    bn: "কর্মকর্তার ইনবক্স: সিদ্ধান্তের অপেক্ষায় থাকা আবেদন, সবচেয়ে জরুরি আগে।",
    en: "Officer inbox: applications waiting for a decision, most urgent first.",
  },
  input: z.object({}),
  output: z.array(
    z.object({
      app_no: z.string(),
      type: z.string(),
      status: z.string(),
      applicant_bn: z.string(),
      summary_bn: z.string(),
      summary_en: z.string(),
      text: z.string().nullable(),
      urgent: z.boolean(),
      fee_taka: z.number(),
      paid_ref: z.string().nullable(),
      hearing_on: z.string().nullable(),
      due_on: z.string().nullable(),
      sla: z.enum(["green", "amber", "red"]),
      days_left: z.number().nullable(),
      can_hear: z.boolean(),
    }),
  ),
  handler: async (_i, ctx) => officeInbox(who(ctx)),
});

export const applicationDecideTool = defineTool({
  name: "application_decide",
  kind: "write",
  access: "officer",
  hiddenFromAgent: true,
  description: {
    bn: "কর্মকর্তার সিদ্ধান্ত: মঞ্জুর (স্বাক্ষরিত ডকুমেন্ট ইস্যু হয়) বা নামঞ্জুর (কারণসহ)।",
    en: "Officer decision: approve (issues the signed document) or reject (with a reason).",
  },
  input: z.object({
    app_no: appNo,
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(500).optional(),
  }),
  output: z.object({ app_no: z.string(), status: z.string(), document_id: z.string().nullable() }),
  handler: async (i, ctx) => decideApplication(who(ctx), i.app_no, i.decision, i.note),
});

const light = z.object({ ok: z.boolean(), bn: z.string(), en: z.string() });

export const documentVerifyTool = defineTool({
  name: "document_verify",
  kind: "read",
  hiddenFromAgent: true,
  description: {
    bn: "ভূমিসাথীর স্বাক্ষরিত ডকুমেন্ট (BD1 কোড) যাচাই: আসল, রেকর্ডে আছে, অক্ষত, হালনাগাদ।",
    en: "Verifies a BhumiSathi signed document (BD1 code): genuine, on record, untouched, current.",
  },
  input: z.object({ code: z.string().trim().min(10).max(8000) }),
  output: z.object({
    overall: z.enum(["green", "amber", "red"]),
    overall_bn: z.string(),
    overall_en: z.string(),
    lights: z.object({ genuine: light, on_record: light, untouched: light, current: light }),
    payload: z.any(),
  }),
  handler: async (i) => verifyDocument(i.code),
  audit: (_i, o) =>
    o.payload ? { action: "doc_verify", mouza: o.payload.mouza_en, dag_no: o.payload.dag_no, detail: { doc_id: o.payload.id, overall: o.overall } } : null, // prettier-ignore
});

export const documentQrTool = defineTool({
  name: "document_qr",
  kind: "read",
  access: "citizen",
  hiddenFromAgent: true,
  description: {
    bn: "নিজের আবেদনের স্বাক্ষরিত ডকুমেন্টের QR কোড।",
    en: "QR code for a signed document of one of your applications.",
  },
  input: z.object({ app_no: appNo }),
  output: z
    .object({ code: z.string(), verify_url: z.string(), qr_svg: z.string(), id: z.string() })
    .nullable(),
  handler: async (i, ctx) => {
    const a = await getApplication(who(ctx), i.app_no); // RLS: only your own (or an officer)
    const doc = a?.documents.find((d) => !d.revoked);
    if (!doc) return null;
    // The code goes after "#": browsers never send that part to any server or log.
    const verify_url = `${siteUrl()}/verify/doc#${doc.code}`;
    const qr_svg = await QRCode.toString(verify_url, { type: "svg", errorCorrectionLevel: "L", margin: 2 }); // prettier-ignore
    return { code: doc.code, verify_url, qr_svg, id: doc.id };
  },
});

export const notificationsTool = defineTool({
  name: "notifications",
  kind: "read",
  access: "citizen",
  hiddenFromAgent: true,
  description: { bn: "আমার নোটিফিকেশন।", en: "My notifications." },
  input: z.object({ mark_read: z.boolean().default(false) }),
  output: z.object({
    unread: z.number(),
    items: z.array(
      z.object({
        id: z.number(),
        at: z.string(),
        title_bn: z.string(),
        title_en: z.string(),
        body_bn: z.string(),
        body_en: z.string(),
        link: z.string().nullable(),
        read: z.boolean(),
      }),
    ),
  }),
  handler: async (i, ctx) => {
    const user = who(ctx);
    if (i.mark_read) await markNotificationsRead(user);
    return myNotifications(user);
  },
});

export const APPLICATION_TOOLS = [
  applicationSubmitTool,
  applicationStatusTool,
  applicationTrackTool,
  applicationPayTool,
  applicationCancelTool,
  applicationInboxTool,
  applicationDecideTool,
  documentVerifyTool,
  documentQrTool,
  notificationsTool,
  complaintSubmitTool,
  applicationHearingTool,
  landTaxDueTool,
  complaintStatsTool,
];

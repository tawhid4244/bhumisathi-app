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
  submitApplication,
  trackApplication,
} from "../engines/applications";
import { verifyDocument } from "../engines/documents";
import { APPLICATION_TYPES, SURVEYS } from "../services/catalog";
import { dagRef } from "./ledger-tools";
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

const feeLine = z.object({ bn: z.string(), en: z.string(), tk: z.number() });

export const applicationSubmitTool = defineTool({
  name: "application_submit",
  kind: "write",
  access: "citizen",
  hiddenFromAgent: true,
  description: {
    bn: "নতুন আবেদন জমা (এখন: খতিয়ানের সার্টিফাইড কপি)।",
    en: "Submits a new application (now: certified khatian copy).",
  },
  input: z.object({
    type: z.enum(Object.keys(APPLICATION_TYPES) as [keyof typeof APPLICATION_TYPES]),
    details: copyDetails,
  }),
  output: z.object({
    app_no: z.string(),
    status: z.string(),
    fee_taka: z.number(),
    fee_lines: z.array(feeLine),
  }),
  handler: async (i, ctx) => submitApplication(who(ctx), i.type, i.details),
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
        mouza_bn: z.string(),
        mouza_en: z.string(),
        dag_no: z.number(),
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
    due_on: z.string(),
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
      applicant_bn: z.string(),
      mouza_bn: z.string(),
      mouza_en: z.string(),
      dag_no: z.number(),
      survey: z.string(),
      fee_taka: z.number(),
      paid_ref: z.string().nullable(),
      due_on: z.string().nullable(),
      sla: z.enum(["green", "amber", "red"]),
      days_left: z.number().nullable(),
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
    note: z.string().trim().max(300).optional(),
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
];

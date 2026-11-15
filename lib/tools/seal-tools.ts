import QRCode from "qrcode";
import { z } from "zod";
import { appendAudit, verifyAuditChain, whoCheckedMyLand } from "../engines/audit";
import { issueSeal, verifySeal } from "../engines/seal";
import { getSql } from "../sql";
import { dagRef } from "./ledger-tools";
import { defineTool } from "./types";

// BhumiSeal-lite and the audit log as tools: the /check page, /verify, /my-land and Sathi AI
// all use these.

/** Absolute address the QR code points to (phones scan it from paper). */
export function siteUrl(): string {
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

const payloadSchema = z.object({
  v: z.literal(1),
  id: z.string(),
  kid: z.string(),
  issued_at: z.string(),
  mouza_bn: z.string(),
  mouza_en: z.string(),
  jl_no: z.number(),
  dag_no: z.number(),
  area_dec: z.number(),
  verdict: z.enum(["red", "amber", "green"]),
  holders: z.array(
    z.object({
      name_bn: z.string(),
      name_en: z.string().optional(),
      recorded_dec: z.number(),
      sellable_dec: z.number(),
    }),
  ),
  ledger_version: z.number(),
});

export const sealIssueTool = defineTool({
  name: "seal_issue",
  kind: "read",
  access: "citizen",
  hiddenFromAgent: true, // the /check page shows the QR; the model has no use for an SVG
  description: {
    bn: "দাগের জমি যাচাই রিপোর্ট ডিজিটাল স্বাক্ষরসহ (BhumiSeal) দেয়, QR কোডসহ; যে কেউ /verify পাতায় যাচাই করতে পারে।",
    en: "Issues a digitally signed (Ed25519) land report for a dag with a QR code that anyone can check on /verify.",
  },
  input: dagRef,
  output: z.object({
    code: z.string(),
    verify_url: z.string(),
    qr_svg: z.string(),
    payload: payloadSchema,
  }),
  handler: async ({ mouza, dag_no }, ctx) => {
    const seal = await issueSeal(mouza, dag_no);
    // Recorded for EVERY issue (also scripts): the "untouched" light looks for this entry.
    const [dag] = await getSql()<{ id: number }[]>`
      select d.id from dags d join mouzas m on m.id = d.mouza_id
      where m.name_en = ${seal.payload.mouza_en} and d.dag_no = ${seal.payload.dag_no}`;
    await appendAudit({
      user: ctx.user,
      action: "seal_issue",
      dag_id: dag?.id ?? null,
      detail: {
        seal_id: seal.payload.id,
        payload_sha256: seal.payload_sha256,
        ledger_version: seal.payload.ledger_version,
      },
    });
    // The code goes after "#": browsers never send that part to any server or log.
    const verify_url = `${siteUrl()}/verify#${seal.code}`;
    const qr_svg = await QRCode.toString(verify_url, { type: "svg", errorCorrectionLevel: "M", margin: 2 }); // prettier-ignore
    return { code: seal.code, verify_url, qr_svg, payload: seal.payload };
  },
});

const light = z.object({ ok: z.boolean(), bn: z.string(), en: z.string() });

export const sealVerifyTool = defineTool({
  name: "seal_verify",
  kind: "read",
  description: {
    bn: "ভূমিসাথীর সিলযুক্ত রিপোর্ট যাচাই করে: আসল কি না, হালনাগাদ কি না, অডিট লগে অক্ষত কি না, অংশের যোগফল মেলে কি না।",
    en: "Checks a BhumiSeal report: genuine signature, still current, untouched in the audit log, shares add up.",
  },
  input: z.object({
    code: z.string().trim().min(1).max(4000).describe("The BS1.… code or the full /verify#… link"),
  }),
  output: z.object({
    overall: z.enum(["green", "amber", "red"]),
    overall_bn: z.string(),
    overall_en: z.string(),
    lights: z.object({
      genuine: light,
      current: light.extend({ events_since: z.number().optional() }),
      untouched: light,
      shares_add_up: light,
    }),
    payload: payloadSchema.nullable(),
    dag_id: z.number().nullable(),
  }),
  handler: async ({ code }) => verifySeal(code),
  audit: (_i, o) => ({
    action: "seal_verify",
    dag_id: o.dag_id,
    detail: { overall: o.overall, seal_id: o.payload?.id ?? null },
  }),
});

export const whoCheckedTool = defineTool({
  name: "who_checked",
  kind: "read",
  access: "citizen",
  description: {
    bn: "আমার জমি কে কবে দেখেছে: নাগরিকের নিজের দাগগুলোর যাচাই, লেজার দেখা, সিল ও নিবন্ধনের চেষ্টার তালিকা (অন্যের নাম ছাড়া)।",
    en: "Who checked my land: views, seals and write attempts on the signed-in holder's own dags (roles only, no names).",
  },
  input: z.object({ limit: z.number().int().min(1).max(100).default(30) }),
  output: z.object({
    linked: z.boolean(),
    entries: z.array(
      z.object({
        id: z.number(),
        at: z.string(),
        role: z.string(),
        role_bn: z.string(),
        role_en: z.string(),
        action: z.string(),
        action_bn: z.string(),
        action_en: z.string(),
        mouza_bn: z.string(),
        mouza_en: z.string(),
        dag_no: z.number(),
        detail: z.record(z.string(), z.unknown()),
      }),
    ),
  }),
  handler: async ({ limit }, ctx) => {
    if (!ctx.user?.owner_id) return { linked: false, entries: [] };
    return { linked: true, entries: await whoCheckedMyLand(ctx.user, limit) };
  },
});

export const auditStatusTool = defineTool({
  name: "audit_status",
  kind: "read",
  access: "officer",
  description: {
    bn: "অডিট লগের শৃঙ্খল অক্ষত কি না যাচাই করে এবং সাম্প্রতিক এন্ট্রি দেখায় (কর্মকর্তাদের জন্য)।",
    en: "Verifies the audit log's hash chain and lists recent entries (officers).",
  },
  input: z.object({}),
  output: z.object({
    ok: z.boolean(),
    entries: z.number(),
    broken_at: z.number().optional(),
    reason: z.enum(["hash", "link", "fields"]).optional(),
    last_hash: z.string(),
  }),
  handler: async () => verifyAuditChain(),
});

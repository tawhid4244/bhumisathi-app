import { z } from "zod";
import { readUpload } from "../adapters/storage";
import { assertCanReadUpload } from "../adapters/uploads";
import { deedExtractSchema, getVisionReader } from "../ai/vision";
import { checkDeed } from "../engines/deed-check";
import { defineTool } from "./types";

// deed_read: an uploaded deed image → fields (vision model) → plain-Bangla summary → cross-check
// against the ledger and the map. The deed's text is untrusted data (see lib/ai/documents.ts).

const reason = z.object({
  code: z.string(),
  severity: z.enum(["red", "amber", "info"]),
  bn: z.string(),
  en: z.string(),
  basis: z.string().optional(),
});

export const deedReadTool = defineTool({
  name: "deed_read",
  kind: "read",
  access: "citizen",
  untrusted: true,
  description: {
    bn: "আপলোড করা দলিলের ছবি পড়ে তথ্য বের করে, সহজ বাংলায় সারাংশ দেয় এবং রেকর্ড ও মৌজা ম্যাপের সাথে মিলিয়ে দেখে।",
    en: "Reads an uploaded deed image, gives a plain-Bangla summary, and cross-checks it with the ledger and the mouza map.",
  },
  input: z.object({
    upload_id: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .describe("Id returned by the deed upload"),
  }),
  output: z.object({
    model: z.string(),
    deed: deedExtractSchema,
    summary_bn: z.string(),
    verdict: z.enum(["red", "amber", "green"]),
    findings: z.array(reason),
    dag: z.object({ mouza_bn: z.string(), mouza_en: z.string(), dag_no: z.number() }).nullable(),
  }),
  audit: (_i, o) =>
    o.dag
      ? {
          action: "read_deed",
          mouza: o.dag.mouza_en,
          dag_no: o.dag.dag_no,
          detail: { verdict: o.verdict },
        }
      : null,
  handler: async ({ upload_id }, ctx) => {
    // Row Level Security: a citizen may read only their own upload (officers may read any).
    if (!ctx.system) await assertCanReadUpload(ctx.user, upload_id);
    const { buf, mime } = await readUpload(upload_id);
    const { deed, model } = await getVisionReader().read(buf, mime);
    const check = await checkDeed(deed);
    return { model, deed, ...check };
  },
});

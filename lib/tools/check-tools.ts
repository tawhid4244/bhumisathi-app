import { z } from "zod";
import { jomiCheck } from "../engines/jomi-check";
import { dagRef, dagRefOptionalMouza, ledgerStatusOutput, mouzaFor } from "./ledger-tools";
import { defineTool } from "./types";

const reason = z.object({
  code: z.string(),
  severity: z.enum(["red", "amber", "info"]),
  bn: z.string(),
  en: z.string(),
  basis: z.string().optional(),
});

const chainEntry = z.object({
  survey: z.enum(["CS", "SA", "RS", "BS"]),
  year: z.number(),
  khatian_no: z.number(),
  survey_dag_no: z.number(),
  area_dec: z.number(),
  owners: z.array(z.object({ name_bn: z.string(), name_en: z.string(), share_dec: z.number() })),
});

export const jomiReportSchema = z.object({
  verdict: z.enum(["red", "amber", "green"]),
  verdict_bn: z.string(),
  verdict_en: z.string(),
  advice_bn: z.string(),
  advice_en: z.string(),
  dag: ledgerStatusOutput.shape.dag,
  reasons: z.array(reason),
  chain: z.array(chainEntry),
  holders: ledgerStatusOutput.shape.holders,
  map_area_dec: z.number().nullable(),
  ledger_version: z.number(),
  checked_on: z.string(),
  disclaimer_bn: z.string(),
  disclaimer_en: z.string(),
  khatian_dags: z.array(z.number()).nullable(),
});

export type JomiReportOutput = z.infer<typeof jomiReportSchema>;

export const jomiCheckTool = defineTool({
  name: "jomi_check",
  kind: "read",
  description: {
    bn: "জমি কেনার আগে যাচাই: দাগ বা খতিয়ান নম্বর দিয়ে লাল/হলুদ/সবুজ রিপোর্ট, কারণ ও সিএস→বিএস রেকর্ড-ধারা।",
    en: "Check before you buy: red/amber/green report for a dag or khatian with reasons and the CS→BS record chain.",
  },
  input: z
    .object({
      mouza: dagRefOptionalMouza.shape.mouza,
      dag_no: dagRef.shape.dag_no.optional(),
      khatian_no: z.number().int().positive().max(99999).optional().describe("BS khatian number"),
      seller_id: z.number().int().positive().optional().describe("Check a specific seller"),
      area_dec: z
        .number()
        .positive()
        .max(100000)
        .optional()
        .describe("Area the seller wants to sell"),
    })
    .refine((v) => v.dag_no != null || v.khatian_no != null, {
      message: "dag_no or khatian_no is required",
    })
    .refine((v) => v.mouza != null || v.dag_no != null, {
      message: "mouza is required with a khatian number",
    }),
  output: jomiReportSchema,
  audit: (_i, o) => ({
    action: "view_report",
    mouza: o.dag.mouza_en,
    dag_no: o.dag.dag_no,
    detail: { verdict: o.verdict },
  }),
  handler: async (i) =>
    jomiCheck({
      mouza: await mouzaFor(i.mouza, i.dag_no!),
      dag_no: i.dag_no,
      khatian_no: i.khatian_no,
      context: { seller_id: i.seller_id, area_dec: i.area_dec },
    }),
});

import { z } from "zod";
import { convertUnits, UNIT_IDS, type UnitId } from "../engines/units";
import { FEE_NOTE, feeGuide, listFees } from "../engines/fees";
import { defineTool } from "./types";

const unitsOut = z.object({
  decimals: z.number(),
  sqft: z.number(),
  sqm: z.number(),
  acre: z.number(),
  katha: z.number(),
  bigha: z.number(),
  bigha_dec: z.number(),
  kani: z.number().nullable(),
});

export const unitConvertTool = defineTool({
  name: "unit_convert",
  kind: "read",
  description: {
    bn: "জমির একক রূপান্তর: শতক, একর, বর্গফুট, কাঠা, বিঘা, কানি, গন্ডা, কড়া, ক্রান্তি। কানির মাপ এলাকাভেদে ভিন্ন হলে প্রতিটি প্রচলিত মাপে ফল দেয়।",
    en: "Converts land units (decimal, acre, sq ft, katha, bigha, kani, gonda, kora, kranti). Regional kani sizes are shown side by side unless a local size is given.",
  },
  input: z.object({
    amounts: z
      .array(
        z.object({
          value: z.number().min(0).max(1e9),
          unit: z.enum(UNIT_IDS as [UnitId, ...UnitId[]]),
        }),
      )
      .min(1)
      .max(6)
      .describe('e.g. [{value:2,unit:"kani"},{value:5,unit:"gonda"}] for "২ কানি ৫ গন্ডা"'),
    kani_dec: z
      .number()
      .positive()
      .max(1000)
      .optional()
      .describe("Local kani size in decimals, if known"),
    bigha_dec: z
      .number()
      .positive()
      .max(1000)
      .optional()
      .describe("Local bigha size in decimals, if not the standard 33.06"),
  }),
  output: z.object({
    uses_kani: z.boolean(),
    variants: z.array(
      z.object({
        kani_dec: z.number().nullable(),
        label_bn: z.string(),
        where_bn: z.string(),
        source: z.string(),
        units: unitsOut,
      }),
    ),
    rules_bn: z.array(z.string()),
  }),
  handler: async (i) => convertUnits(i.amounts, { kaniDec: i.kani_dec, bighaDec: i.bigha_dec }),
});

const service = z.object({
  id: z.string(),
  bn: z.string(),
  en: z.string(),
  items: z.array(z.object({ bn: z.string(), en: z.string(), tk: z.number(), when_bn: z.string() })),
  total_tk: z.number().nullable(),
  components_bn: z.array(z.string()).optional(),
  time_bn: z.string(),
  law_id: z.string().optional(),
  source: z.string(),
  verified: z.string(),
});

export const feeGuideTool = defineTool({
  name: "fee_guide",
  kind: "read",
  description: {
    bn: "সরকারি সেবার ফি ও সময় (নামজারি, খতিয়ানের কপি, মৌজা ম্যাপ, দলিল রেজিস্ট্রি), প্রতিটি লাইনের সূত্রসহ। এর বাইরে কোনো টাকা সরকারি ফি নয়।",
    en: "Official fees and times for land services (mutation, khatian copy, mouza map, deed registration), each line with its source.",
  },
  input: z.object({
    service: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .describe('Service id or name, e.g. "mutation", "নামজারি", "খতিয়ান", "রেজিস্ট্রি"'),
  }),
  output: z.object({
    note: z.string(),
    service: service.nullable(),
    available: z.array(z.string()),
  }),
  handler: async ({ service: s }) => ({
    note: FEE_NOTE,
    service: feeGuide(s),
    available: listFees().map((x) => `${x.id}: ${x.bn}`),
  }),
});

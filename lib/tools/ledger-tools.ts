import { z } from "zod";
import { findDag, findPerson, getLedgerStatus, registerEvent } from "../engines/ledger";
import { defineTool } from "./types";

// Ledger tools: ledger_status (read) and register_baina / register_sale / register_lien (write).

export const dagRef = z.object({
  mouza: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .describe("Mouza name (Bangla or English), code or JL number, e.g. নয়াপাড়া, Nayapara, 45"),
  dag_no: z.number().int().positive().max(99999).describe("Dag (plot) number, e.g. 145"),
});

const area = z.number().positive().max(100000).describe("Area in decimals (শতক), e.g. 10");
const ownerId = z.number().int().positive();

const holder = z.object({
  owner_id: z.number(),
  name_bn: z.string(),
  name_en: z.string(),
  is_deceased: z.boolean(),
  recorded_dec: z.number(),
  sold_dec: z.number(),
  reserved_dec: z.number(),
  locked_dec: z.number(),
  sellable_dec: z.number(),
});

export const ledgerStatusOutput = z.object({
  dag: z.object({
    id: z.number(),
    mouza_id: z.number(),
    mouza_bn: z.string(),
    mouza_en: z.string(),
    jl_no: z.number(),
    dag_no: z.number(),
    recorded_area_dec: z.number(),
    land_class_bn: z.string(),
    land_class_en: z.string(),
    version: z.number(),
    is_khas: z.boolean(),
    pending_cases: z.string().nullable(),
  }),
  holders: z.array(holder),
  active_bainas: z.array(
    z.object({
      id: z.string(),
      seller_id: z.number(),
      buyer_id: z.number(),
      buyer_bn: z.string(),
      area_dec: z.number(),
      expires_on: z.string(),
    }),
  ),
  active_liens: z.array(
    z.object({
      id: z.string(),
      owner_id: z.number(),
      lender_bn: z.string(),
      lender_en: z.string(),
      area_dec: z.number(),
      loan_ref: z.string(),
    }),
  ),
  recent_events: z.array(
    z.object({
      id: z.number(),
      event_type: z.string(),
      status: z.string(),
      area_dec: z.number(),
      ref: z.string().nullable(),
      reason_bn: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
});

export const registerOutput = z.object({
  ok: z.boolean(),
  event_id: z.number().optional(),
  ref: z.string().optional(),
  mutation_case: z.string().nullable().optional(),
  reason_bn: z.string().optional(),
  reason_en: z.string().optional(),
  version: z.number(),
});

export const ledgerStatusTool = defineTool({
  name: "ledger_status",
  kind: "read",
  access: "citizen",
  description: {
    bn: "একটি দাগের প্রত্যেক মালিকের রেকর্ডীয় অংশ, বিক্রি, বায়না, বন্ধক ও বিক্রয়যোগ্য পরিমাণ দেখায়।",
    en: "Shows each holder's recorded share, sales, active bainas, mortgages and sellable balance for a dag.",
  },
  input: dagRef,
  output: ledgerStatusOutput,
  handler: async ({ mouza, dag_no }) => getLedgerStatus(mouza, dag_no),
});

export const registerBainaTool = defineTool({
  name: "register_baina",
  kind: "write",
  access: "officer", // only a sub-registry officer records sales, bainas and mortgages
  description: {
    bn: "নিবন্ধিত বায়না রেকর্ড করে; মেয়াদ পর্যন্ত ওই অংশ অন্য কারো কাছে বিক্রি করা যায় না।",
    en: "Records a registered baina (sale agreement); that portion is reserved until it expires.",
  },
  input: dagRef.extend({
    seller_id: ownerId,
    buyer_id: ownerId,
    area_dec: area,
    days: z.number().int().min(1).max(365).default(90).describe("Validity in days"),
  }),
  output: registerOutput,
  handler: async (i) =>
    registerEvent({
      type: "baina",
      mouza: i.mouza,
      dagNo: i.dag_no,
      ownerId: i.seller_id,
      counterpartyId: i.buyer_id,
      area: i.area_dec,
      days: i.days,
    }),
});

export const registerSaleTool = defineTool({
  name: "register_sale",
  kind: "write",
  access: "officer", // only a sub-registry officer records sales, bainas and mortgages
  description: {
    bn: "বিক্রয় দলিল নিবন্ধন করে, যদি বিক্রেতার বিক্রয়যোগ্য অংশ যথেষ্ট থাকে; নামজারি মামলা খোলে।",
    en: "Registers a sale deed if the seller's sellable balance allows it, and opens a mutation case.",
  },
  input: dagRef.extend({ seller_id: ownerId, buyer_id: ownerId, area_dec: area }),
  output: registerOutput,
  handler: async (i) =>
    registerEvent({
      type: "sale",
      mouza: i.mouza,
      dagNo: i.dag_no,
      ownerId: i.seller_id,
      counterpartyId: i.buyer_id,
      area: i.area_dec,
    }),
});

export const registerLienTool = defineTool({
  name: "register_lien",
  kind: "write",
  access: "officer", // only a sub-registry officer records sales, bainas and mortgages
  description: {
    bn: "ব্যাংকের বন্ধক (দায়) রেকর্ড করে; ছাড়পত্র না দেওয়া পর্যন্ত ওই অংশ বিক্রি করা যায় না।",
    en: "Records a bank mortgage (lien); that portion cannot be sold until the bank releases it.",
  },
  input: dagRef.extend({
    owner_id: ownerId,
    lender_id: ownerId,
    area_dec: area,
    loan_ref: z.string().trim().min(1).max(40).optional(),
  }),
  output: registerOutput,
  handler: async (i) =>
    registerEvent({
      type: "lien",
      mouza: i.mouza,
      dagNo: i.dag_no,
      ownerId: i.owner_id,
      counterpartyId: i.lender_id,
      area: i.area_dec,
      ref: i.loan_ref,
    }),
});

export const findDagTool = defineTool({
  name: "find_dag",
  kind: "read",
  description: {
    bn: "শুধু দাগ নম্বর জানা থাকলে কোন কোন মৌজায় ওই নম্বরের দাগ আছে তা খুঁজে দেয়।",
    en: "Finds which mouzas have a dag with this number (use when the mouza was not given).",
  },
  input: z.object({ dag_no: dagRef.shape.dag_no }),
  output: z.array(
    z.object({ mouza_bn: z.string(), mouza_en: z.string(), jl_no: z.number(), dag_no: z.number() }),
  ),
  handler: async ({ dag_no }) => findDag(dag_no),
});

export const findPersonTool = defineTool({
  name: "find_person",
  kind: "read",
  access: "citizen",
  description: {
    bn: "নাম দিয়ে ব্যক্তি বা ব্যাংকের আইডি খুঁজে দেয় (বিক্রি, বায়না বা বন্ধক নিবন্ধনের জন্য ক্রেতা বা ব্যাংকের আইডি লাগে)।",
    en: "Finds a person's or bank's owner id by name (needed for the buyer or bank when recording a sale, baina or mortgage).",
  },
  input: z.object({
    name: z.string().trim().min(2).max(80).describe("Name as the citizen said it"),
  }),
  output: z.array(
    z.object({ owner_id: z.number(), name_bn: z.string(), name_en: z.string(), kind: z.string() }),
  ),
  handler: async ({ name }) => findPerson(name),
});

import { z } from "zod";
import { computeWarishLand } from "../engines/warish-land";
import { defineTool } from "./types";

// warish_compute: each heir's share (Hanafi faraid + MFLO 1961 s.4) and, per dag, in decimals.

const count = (max: number) => z.number().int().min(0).max(max).optional();
const predeceased = z
  .array(
    z.object({ sons: z.number().int().min(0).max(30), daughters: z.number().int().min(0).max(30) }),
  )
  .max(20)
  .optional()
  .describe(
    "Children who died before the deceased, with the number of THEIR living sons and daughters",
  );

export const familySchema = z.object({
  husband: z.boolean().optional(),
  wives: count(4),
  father: z.boolean().optional(),
  mother: z.boolean().optional(),
  sons: count(30),
  daughters: count(30),
  predeceasedSons: predeceased,
  predeceasedDaughters: predeceased,
  fullBrothers: count(30),
  fullSisters: count(30),
});

const share = z.object({
  key: z.string(),
  relation: z.string(),
  label_bn: z.string(),
  label_en: z.string(),
  fraction: z.string(),
  percent: z.number(),
  basis_bn: z.string(),
  basis_en: z.string(),
  per_dag: z.array(z.object({ mouza_bn: z.string(), dag_no: z.number(), decimals: z.number() })),
  total_dec: z.number(),
});

export const warishComputeTool = defineTool({
  name: "warish_compute",
  kind: "read",
  description: {
    bn: "ফারায়েজ (হানাফি) ও মুসলিম পারিবারিক আইন অধ্যাদেশ ১৯৬১ ধারা ৪ অনুযায়ী প্রত্যেক ওয়ারিশের অংশ — ভগ্নাংশ, শতাংশ এবং মৃত ব্যক্তির প্রতিটি দাগে শতকে।",
    en: "Each heir's share under Hanafi faraid and MFLO 1961 s.4: fraction, percent, and decimals in each of the deceased's dags.",
  },
  input: z.object({
    family: familySchema,
    deceased_owner_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Deceased owner's id, to split each of their dags"),
    total_dec: z.number().positive().max(100000).optional().describe("Or a total area in decimals"),
  }),
  output: z.object({
    deceased: z
      .object({
        owner_id: z.number(),
        name_bn: z.string(),
        name_en: z.string(),
        died_on: z.string().nullable(),
      })
      .nullable(),
    holdings: z.array(
      z.object({
        mouza_bn: z.string(),
        mouza_en: z.string(),
        dag_no: z.number(),
        share_dec: z.number(),
      }),
    ),
    shares: z.array(share),
    flags: z.object({
      awl: z.boolean(),
      radd: z.boolean(),
      umariyyatayn: z.boolean(),
      mflo: z.boolean(),
      spouseRadd: z.boolean(),
    }),
    steps_bn: z.array(z.string()),
    steps_en: z.array(z.string()),
  }),
  handler: async (i) => computeWarishLand(i),
});

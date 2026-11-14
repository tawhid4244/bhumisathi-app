import { z } from "zod";
import { mapArea } from "../engines/map";
import { dagRef } from "./ledger-tools";
import { defineTool } from "./types";

export const mapAreaTool = defineTool({
  name: "map_area",
  kind: "read",
  description: {
    bn: "মৌজা ম্যাপ থেকে দাগের মাপ (শতক, কাঠা, বিঘা, একর, বর্গফুট) এবং খতিয়ানের আয়তনের সাথে তুলনা; খাস জমি চিহ্নিত করে।",
    en: "A dag's area measured on the mouza map (decimals, katha, bigha, acre, sq ft), compared with the khatian; flags khas land.",
  },
  input: dagRef,
  output: z.object({
    mouza_bn: z.string(),
    mouza_en: z.string(),
    dag_no: z.number(),
    map_area_dec: z.number(),
    recorded_area_dec: z.number(),
    difference_dec: z.number(),
    matches_khatian: z.boolean(),
    is_khas: z.boolean(),
    units: z.object({
      decimals: z.number(),
      sqft: z.number(),
      sqm: z.number(),
      acre: z.number(),
      katha: z.number(),
      bigha: z.number(),
      bigha_dec: z.number(),
    }),
    note_bn: z.string(),
  }),
  handler: async ({ mouza, dag_no }) => mapArea(mouza, dag_no),
});

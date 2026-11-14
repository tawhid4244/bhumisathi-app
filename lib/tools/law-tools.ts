import { z } from "zod";
import { searchLaws } from "../ai/rag";
import { defineTool } from "./types";

// law_search: find the cited law sections (content/laws) that answer a legal question.

export const lawHitSchema = z.object({
  law_id: z.string(),
  law_bn: z.string(),
  law_en: z.string(),
  section: z.string(),
  title_bn: z.string(),
  title_en: z.string(),
  source: z.string(),
  verified: z.string(),
  excerpt: z.string(),
  score: z.number(),
});

export const lawSearchTool = defineTool({
  name: "law_search",
  kind: "read",
  untrusted: true, // retrieved documents → shown to the model as data only
  description: {
    bn: "ভূমি আইন ও সরকারি সেবা-তথ্য (নামজারি ফি, বায়না, ওয়ারিশ, মামলা, দখল ইত্যাদি) থেকে প্রাসঙ্গিক ধারা খুঁজে দেয়, সূত্রসহ। ফল খালি হলে কোনো সূত্র নেই।",
    en: "Searches the cited land-law library (mutation fees, baina, inheritance, court cases, possession, ...) and returns matching sections with their source. An empty result means there is no source.",
  },
  input: z.object({
    query: z.string().trim().min(2).max(300).describe("The legal question, in Bangla or English"),
  }),
  output: z.array(lawHitSchema),
  handler: async ({ query }) => searchLaws(query),
});

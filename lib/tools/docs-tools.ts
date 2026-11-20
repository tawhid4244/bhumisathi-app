import { z } from "zod";
import { setDocsSettings } from "../engines/docs";
import { defineTool } from "./types";

const iso = z.iso.datetime({ offset: true }).nullable();

// Admins open or close the public /docs page and can limit it to a time window (judging week).
export const docsSettingsUpdateTool = defineTool({
  name: "docs_settings_update",
  kind: "write",
  access: "admin",
  hiddenFromAgent: true,
  description: {
    bn: "/docs পাতাটি সবার জন্য খোলা থাকবে কি না এবং কোন সময়ে খোলা থাকবে তা ঠিক করে (প্রশাসক)।",
    en: "Turns the public /docs page on or off and sets its open window (admins).",
  },
  input: z
    .object({ visible: z.boolean(), starts_at: iso, ends_at: iso })
    .refine((s) => !s.starts_at || !s.ends_at || s.ends_at > s.starts_at, {
      message: "ends_at must be after starts_at",
    }),
  output: z.object({
    visible: z.boolean(),
    starts_at: z.string().nullable(),
    ends_at: z.string().nullable(),
    updated_at: z.string().nullable(),
  }),
  audit: (i) => ({ action: "docs_settings", detail: { visible: i.visible } }),
  handler: async (input) => setDocsSettings(input),
});

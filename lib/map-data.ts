import { z } from "zod";
import raw from "../content/maps/nayapara.json";
import type { Point } from "./engines/area";

// The Nayapara mouza map (content/maps/nayapara.json), validated once and typed.
const pointSchema = z.tuple([z.number(), z.number()]);

const mapSchema = z.object({
  mouza: z.string(),
  jl: z.number().int(),
  sheet: z.number().int(),
  scale: z.string(),
  units_per_inch: z.number().positive(),
  decimals_per_square_inch: z.number().positive(),
  is_synthetic: z.literal(true),
  dags: z.record(z.string(), z.array(pointSchema).min(3)),
  khas: z.array(z.string()),
  khatian_offset_decimals: z.record(z.string(), z.number()),
});

export type MouzaMap = Omit<z.infer<typeof mapSchema>, "dags"> & {
  dags: Record<string, Point[]>;
};

export const nayaparaMap: MouzaMap = mapSchema.parse(raw);

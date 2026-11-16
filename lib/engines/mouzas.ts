import { getSql } from "../sql";

export interface MouzaOption {
  code: string;
  name_bn: string;
  name_en: string;
  jl_no: number;
}

/** All mouzas, for search forms. */
export async function listMouzas(): Promise<MouzaOption[]> {
  const sql = getSql();
  return sql<MouzaOption[]>`select code, name_bn, name_en, jl_no from mouzas order by jl_no`;
}

let cache: { at: number; rows: Promise<MouzaOption[]> } | null = null;

/** listMouzas with a 5-minute memory cache (the chat's fast path asks on every message). */
export function cachedMouzas(): Promise<MouzaOption[]> {
  const now = performance.now();
  if (!cache || now - cache.at > 300_000) {
    const rows = listMouzas();
    cache = { at: now, rows };
    rows.catch(() => (cache = null));
  }
  return cache.rows;
}

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

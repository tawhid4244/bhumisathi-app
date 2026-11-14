import { getSql } from "../sql";
import { centroid, polygonAreaDecimals, round, type Point } from "./area";
import { resolveDag, westernDigits } from "./ledger";
import { MAP_MISMATCH_DEC, MAP_MISMATCH_PCT } from "./rules";
import { fromDecimals, type AreaUnits } from "./units";

// Mouza map data and the map_area tool: a dag's area measured on the map, next to the khatian.

export interface MapDag {
  dag_no: number;
  points: Point[];
  label_at: Point;
  map_area_dec: number;
  recorded_area_dec: number;
  is_khas: boolean;
  mismatch: boolean;
}

export interface MouzaMapData {
  mouza_bn: string;
  mouza_en: string;
  jl_no: number;
  scale_in_per_mile: number;
  units_per_inch: number;
  dags: MapDag[];
}

export class NoMapError extends Error {}

const isMismatch = (recorded: number, map: number) => {
  const diff = Math.abs(recorded - map);
  return diff >= MAP_MISMATCH_DEC || diff / map >= MAP_MISMATCH_PCT;
};

/** All dag outlines of a mouza that has a map. */
export async function loadMouzaMap(mouza: string): Promise<MouzaMapData> {
  const sql = getSql();
  const m = westernDigits(mouza.trim()).toLowerCase();
  const rows = await sql<{
    mouza_bn: string; mouza_en: string; jl_no: number; scale: number | null;
    dag_no: number; points: Point[]; units_per_inch: number; recorded: number; is_khas: boolean;
  }[]>`
    select mz.name_bn as mouza_bn, mz.name_en as mouza_en, mz.jl_no, mz.map_scale_in_per_mile as scale,
           d.dag_no, p.points, p.units_per_inch, d.recorded_area_dec::float8 as recorded,
           exists (select 1 from khas_flags k where k.dag_id = d.id) as is_khas
    from map_polygons p join dags d on d.id = p.dag_id join mouzas mz on mz.id = d.mouza_id
    where lower(mz.name_en) = ${m} or mz.name_bn = ${mouza.trim()} or lower(mz.code) = ${m}
          or mz.jl_no::text = ${m}
    order by d.dag_no`; // prettier-ignore
  if (rows.length === 0) throw new NoMapError(`No mouza map for "${mouza}".`);
  const scale = rows[0]!.scale ?? 16;
  return {
    mouza_bn: rows[0]!.mouza_bn,
    mouza_en: rows[0]!.mouza_en,
    jl_no: rows[0]!.jl_no,
    scale_in_per_mile: scale,
    units_per_inch: rows[0]!.units_per_inch,
    dags: rows.map((r) => {
      const area = round(polygonAreaDecimals(r.points, r.units_per_inch, scale), 2);
      return {
        dag_no: r.dag_no,
        points: r.points,
        label_at: centroid(r.points),
        map_area_dec: area,
        recorded_area_dec: r.recorded,
        is_khas: r.is_khas,
        mismatch: isMismatch(r.recorded, area),
      };
    }),
  };
}

export interface MapAreaResult {
  mouza_bn: string;
  mouza_en: string;
  dag_no: number;
  map_area_dec: number;
  recorded_area_dec: number;
  difference_dec: number;
  matches_khatian: boolean;
  is_khas: boolean;
  units: AreaUnits;
  note_bn: string;
}

export async function mapArea(mouza: string, dagNo: number): Promise<MapAreaResult> {
  await resolveDag(mouza, dagNo); // clear "dag not found" error first
  const map = await loadMouzaMap(mouza);
  const d = map.dags.find((x) => x.dag_no === dagNo);
  if (!d) throw new NoMapError(`Dag ${dagNo} is not drawn on the ${map.mouza_en} map.`);
  const diff = round(d.recorded_area_dec - d.map_area_dec, 2);
  const notes = [
    "মৌজা ম্যাপের স্কেল (১৬ ইঞ্চি = ১ মাইল) থেকে হিসাব করা আনুমানিক মাপ; আইনি মাপ আমিনের জরিপ।",
  ];
  if (d.mismatch) notes.unshift("খতিয়ান ও ম্যাপের মাপে বড় পার্থক্য — আমিন দিয়ে সীমানা যাচাই করুন।");
  if (d.is_khas) notes.unshift("এটি খাস (সরকারি) জমি — ব্যক্তিগতভাবে কেনা-বেচা করা যায় না।");
  return {
    mouza_bn: map.mouza_bn,
    mouza_en: map.mouza_en,
    dag_no: d.dag_no,
    map_area_dec: d.map_area_dec,
    recorded_area_dec: d.recorded_area_dec,
    difference_dec: diff,
    matches_khatian: !d.mismatch,
    is_khas: d.is_khas,
    units: fromDecimals(d.map_area_dec),
    note_bn: notes.join(" "),
  };
}

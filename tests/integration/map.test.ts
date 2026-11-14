import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadMouzaMap, mapArea, NoMapError } from "@/lib/engines/map";
import { runTool } from "@/lib/tools/registry";
import { closeSql, getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";

const sql = getSql();
beforeAll(() => seed(sql));
afterAll(() => closeSql());

describe("map_area on the Nayapara map", () => {
  it("G8: dag 145 ≈ 20.0 decimals and matches the khatian", async () => {
    const r = await mapArea("নয়াপাড়া", 145);
    expect(r.map_area_dec).toBeCloseTo(20.04, 2);
    expect(r.recorded_area_dec).toBe(20);
    expect(r.matches_khatian).toBe(true);
  });

  it("dag 143: khatian 3 dec more than the map → mismatch, verify with an amin", async () => {
    const r = await mapArea("Nayapara", 143);
    expect(r.difference_dec).toBeCloseTo(3.04, 2);
    expect(r.matches_khatian).toBe(false);
    expect(r.note_bn).toContain("আমিন");
  });

  it("dag 149 is khas", async () => {
    const r = await mapArea("45", 149);
    expect(r.is_khas).toBe(true);
    expect(r.note_bn).toContain("খাস");
  });

  it("the whole map: 9 dags, 143 marked mismatch, 149 khas", async () => {
    const m = await loadMouzaMap("Nayapara");
    expect(m.dags.map((d) => d.dag_no)).toEqual([141, 142, 143, 144, 145, 146, 147, 148, 149]);
    expect(m.dags.filter((d) => d.mismatch).map((d) => d.dag_no)).toEqual([143]);
    expect(m.dags.filter((d) => d.is_khas).map((d) => d.dag_no)).toEqual([149]);
  });

  it("Charpara has no map; a dag not drawn on the map is reported clearly", async () => {
    await expect(mapArea("Charpara", 210)).rejects.toThrow(NoMapError);
    await expect(mapArea("Nayapara", 160)).rejects.toThrow(NoMapError);
  });

  it("the tool validates its output", async () => {
    const r = (await runTool("map_area", { mouza: "Nayapara", dag_no: 145 })) as {
      units: { katha: number };
    };
    expect(r.units.katha).toBeCloseTo(12.12, 2);
  });
});

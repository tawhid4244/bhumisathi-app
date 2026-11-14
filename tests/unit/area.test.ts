import { describe, expect, it } from "vitest";
import { nayaparaMap as map } from "@/lib/map-data";
import {
  decimalsPerSquareInch,
  polygonAreaDecimals,
  round,
  shoelaceArea,
  type Point,
} from "@/lib/engines/area";

describe("area engine", () => {
  it("16 inches = 1 mile gives 250 decimals per square inch", () => {
    expect(decimalsPerSquareInch(16)).toBeCloseTo(250, 9);
  });

  it("shoelace works for a unit square in either winding order", () => {
    const sq: Point[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(shoelaceArea(sq)).toBe(1);
    expect(shoelaceArea([...sq].reverse())).toBe(1);
  });

  it("a 1 x 1 inch square on a 16-inch map is 250 decimals", () => {
    const inch: Point[] = [
      [0, 0],
      [1000, 0],
      [1000, 1000],
      [0, 1000],
    ];
    expect(polygonAreaDecimals(inch, 1000, 16)).toBeCloseTo(250, 9);
  });

  it("dag 145 on the Nayapara map is about 20.0 decimals (G1, G8)", () => {
    const pts = map.dags["145"]!;
    expect(round(polygonAreaDecimals(pts, map.units_per_inch, 16), 1)).toBe(20.0);
  });

  it("rejects fewer than 3 points", () => {
    expect(() =>
      shoelaceArea([
        [0, 0],
        [1, 1],
      ]),
    ).toThrow();
  });

  it("round avoids floating-point surprises", () => {
    expect(round(1.005, 2)).toBe(1.01);
  });
});

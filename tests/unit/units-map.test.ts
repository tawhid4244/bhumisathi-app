import { describe, expect, it } from "vitest";
import { calibratedAreaDecimals, centroid, type Point } from "@/lib/engines/area";
import { fromDecimals, STANDARD_BIGHA_DEC } from "@/lib/engines/units";

describe("units", () => {
  it("1 decimal = 435.6 sq ft; 100 decimals = 1 acre; 1 katha = 720 sq ft", () => {
    expect(fromDecimals(1).sqft).toBe(436); // rounded to whole sq ft
    expect(fromDecimals(100).acre).toBe(1);
    expect(fromDecimals(720 / 435.6).katha).toBeCloseTo(1, 2);
  });

  it("dag 145 (20.04 dec) in all units", () => {
    expect(fromDecimals(20.04)).toEqual({
      decimals: 20.04,
      sqft: 8729,
      sqm: 811,
      acre: 0.2004,
      katha: 12.12,
      bigha: 0.606,
      bigha_dec: 33.06,
    });
  });

  it("standard bigha ≈ 33.06 decimals; a district size can be passed", () => {
    expect(STANDARD_BIGHA_DEC).toBeCloseTo(33.0579, 3);
    expect(fromDecimals(30, 30).bigha).toBe(1);
  });
});

describe("measuring on an uploaded map", () => {
  const square = (s: number): Point[] => [
    [0, 0],
    [s, 0],
    [s, s],
    [0, s],
  ];

  it("1 px = 1 ft: a 100 × 100 px square is 10,000 sq ft ≈ 22.96 dec", () => {
    expect(calibratedAreaDecimals(square(100), [0, 0], [50, 0], 50)).toBeCloseTo(10000 / 435.6, 6);
  });

  it("the scale can be measured in any direction", () => {
    // 3-4-5 triangle: the two clicks are 500 px apart and represent 1000 ft → 2 ft per px
    const dec = calibratedAreaDecimals(square(100), [0, 0], [300, 400], 1000);
    expect(dec).toBeCloseTo((100 * 2) ** 2 / 435.6, 6);
  });

  it("refuses a calibration without distance", () => {
    expect(() => calibratedAreaDecimals(square(10), [0, 0], [0, 0], 10)).toThrow();
    expect(() => calibratedAreaDecimals(square(10), [0, 0], [5, 0], 0)).toThrow();
  });

  it("centroid places labels in the middle", () => {
    expect(centroid(square(100))).toEqual([50, 50]);
  });
});

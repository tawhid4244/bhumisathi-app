// Map area engine: polygon area from a mouza map, in decimals (shotangsho).
//
// Mouza maps are drawn at a fixed scale, usually 16 inches = 1 mile.
//   1 inch on the map = 5,280 ft / 16 = 330 ft on the ground
//   1 square inch     = 330 × 330 = 108,900 sq ft = 250 decimals (1 decimal = 435.6 sq ft)
// The result is an estimate from a drawing, never a survey; an amin's measurement is the legal one.

export type Point = readonly [number, number];

export const SQFT_PER_DECIMAL = 435.6;
export const FEET_PER_MILE = 5280;

/** Shoelace formula: area of a simple polygon in the same (squared) units as its points. */
export function shoelaceArea(points: readonly Point[]): number {
  if (points.length < 3) throw new Error("A polygon needs at least 3 points.");
  let twiceArea = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    twiceArea += x1 * y2 - x2 * y1;
  }
  return Math.abs(twiceArea) / 2;
}

/** Decimals represented by one square inch of map at a given scale (inches per mile). */
export function decimalsPerSquareInch(inchesPerMile: number): number {
  const feetPerInch = FEET_PER_MILE / inchesPerMile;
  return (feetPerInch * feetPerInch) / SQFT_PER_DECIMAL;
}

/**
 * Area in decimals of a polygon drawn in map units.
 * @param unitsPerInch how many map units make one inch on the paper map (nayapara.json: 1000)
 * @param inchesPerMile map scale (16 for standard mouza maps)
 */
export function polygonAreaDecimals(
  points: readonly Point[],
  unitsPerInch: number,
  inchesPerMile = 16,
): number {
  const squareInches = shoelaceArea(points) / (unitsPerInch * unitsPerInch);
  return squareInches * decimalsPerSquareInch(inchesPerMile);
}

/** Round to a fixed number of decimal places without floating-point surprises like 1.005. */
export function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/**
 * Area from an uploaded map image: the citizen clicks two points a known ground distance apart
 * (the scale bar, or a road of known length), then the plot's corners. Pixels → feet → decimals.
 * An estimate from a picture, never a survey.
 */
export function calibratedAreaDecimals(
  polygonPx: readonly Point[],
  calibA: Point,
  calibB: Point,
  knownFeet: number,
): number {
  const px = Math.hypot(calibB[0] - calibA[0], calibB[1] - calibA[1]);
  if (px <= 0 || !(knownFeet > 0))
    throw new Error("Calibration needs two different points and a distance.");
  const feetPerPx = knownFeet / px;
  const sqft = shoelaceArea(polygonPx) * feetPerPx * feetPerPx;
  return sqft / SQFT_PER_DECIMAL;
}

/** Centre of a polygon (average of its corners), for placing a dag label. */
export function centroid(points: readonly Point[]): Point {
  const n = points.length;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

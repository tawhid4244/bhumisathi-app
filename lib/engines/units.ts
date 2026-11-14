import { round, SQFT_PER_DECIMAL } from "./area";

// Land units. The decimal (শতক) is the base: 1 decimal = 1/100 acre = 435.6 sq ft.
// Katha is commonly 720 sq ft. Bigha and kani differ by region, so they always come with the
// size used, and task 14 adds the district table and the converter page.

export const SQFT_PER_ACRE = 43_560;
export const SQM_PER_SQFT = 0.09290304;
export const SQFT_PER_KATHA = 720;
/** Standard bigha = 20 katha = 14,400 sq ft ≈ 33.06 decimals (varies by district). */
export const STANDARD_BIGHA_DEC = (20 * SQFT_PER_KATHA) / SQFT_PER_DECIMAL;

export interface AreaUnits {
  decimals: number;
  sqft: number;
  sqm: number;
  acre: number;
  katha: number;
  bigha: number;
  /** The bigha size used for the bigha figure, in decimals. */
  bigha_dec: number;
}

export function fromDecimals(dec: number, bighaDec = STANDARD_BIGHA_DEC): AreaUnits {
  const sqft = dec * SQFT_PER_DECIMAL;
  return {
    decimals: round(dec, 2),
    sqft: round(sqft, 0),
    sqm: round(sqft * SQM_PER_SQFT, 1),
    acre: round(dec / 100, 4),
    katha: round(sqft / SQFT_PER_KATHA, 2),
    bigha: round(dec / bighaDec, 3),
    bigha_dec: round(bighaDec, 2),
  };
}

export const decimalsFromSqft = (sqft: number) => sqft / SQFT_PER_DECIMAL;

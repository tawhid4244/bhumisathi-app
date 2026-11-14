import { describe, expect, it } from "vitest";
import { computeSellable, westernDigits } from "@/lib/engines/ledger";

const base = { recorded: 20, sold: 0, reserved: 0, locked: 0, blocked: false };

describe("sellable balance maths", () => {
  it("a clean share is fully sellable", () => {
    expect(computeSellable(base)).toBe(20);
  });

  it("G1 after baina B-0021: 20 − 10 reserved = 10", () => {
    expect(computeSellable({ ...base, reserved: 10 })).toBe(10);
  });

  it("G1 after the 10-dec sale: 20 − 10 sold − 10 reserved = 0", () => {
    expect(computeSellable({ ...base, reserved: 10, sold: 10 })).toBe(0);
  });

  it("subtracts sales, bainas and mortgages together", () => {
    expect(
      computeSellable({ recorded: 20.9, sold: 3, reserved: 2.5, locked: 5, blocked: false }),
    ).toBe(10.4);
  });

  it("never goes below zero", () => {
    expect(computeSellable({ ...base, sold: 25 })).toBe(0);
  });

  it("a whole-dag block (khas, court case, deceased owner) makes it zero", () => {
    expect(computeSellable({ ...base, blocked: true })).toBe(0);
  });

  it("avoids floating-point noise", () => {
    expect(
      computeSellable({ recorded: 0.3, sold: 0.1, reserved: 0.1, locked: 0, blocked: false }),
    ).toBe(0.1);
  });
});

describe("westernDigits", () => {
  it("turns Bangla digits into Western digits", () => {
    expect(westernDigits("১৪৫")).toBe("145");
    expect(westernDigits("JL ৪৫")).toBe("JL 45");
  });
});

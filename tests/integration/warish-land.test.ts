import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runTool } from "@/lib/tools/registry";
import { closeSql, getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";
import { OWNER } from "@/scripts/seed-data";

const sql = getSql();
beforeAll(() => seed(sql));
afterAll(() => closeSql());

describe("warish_compute on the seeded world (G2)", () => {
  it("Abdul Karim's family: per-dag decimals for Charpara 210 and 211", async () => {
    const r = (await runTool("warish_compute", {
      family: { wives: 1, sons: 2, daughters: 1 },
      deceased_owner_id: OWNER.ABDUL_KARIM,
    })) as {
      deceased: { name_bn: string };
      holdings: { dag_no: number; share_dec: number }[];
      shares: { key: string; fraction: string; percent: number; per_dag: { dag_no: number; decimals: number }[]; total_dec: number }[]; // prettier-ignore
    };
    expect(r.deceased.name_bn).toBe("আব্দুল করিম");
    expect(r.holdings.map((h) => [h.dag_no, h.share_dec])).toEqual([
      [210, 60],
      [211, 40],
    ]);
    const row = (key: string) => r.shares.find((s) => s.key === key)!;
    expect(row("wife")).toMatchObject({ fraction: "1/8", percent: 12.5, total_dec: 12.5 });
    expect(row("wife").per_dag.map((p) => p.decimals)).toEqual([7.5, 5]);
    expect(row("son-1").per_dag.map((p) => p.decimals)).toEqual([21, 14]);
    expect(row("son-2").per_dag.map((p) => p.decimals)).toEqual([21, 14]);
    expect(row("daughter")).toMatchObject({ fraction: "7/40", percent: 17.5 });
    expect(row("daughter").per_dag.map((p) => p.decimals)).toEqual([10.5, 7]);
  });

  it("works without land (fractions only) and with a total area", async () => {
    const r = (await runTool("warish_compute", {
      family: { mother: true, daughters: 1 },
      total_dec: 100,
    })) as {
      shares: { key: string; total_dec: number }[];
    };
    expect(r.shares.map((s) => [s.key, s.total_dec])).toEqual([
      ["mother", 25],
      ["daughter", 75],
    ]);
  });

  it("rejects an impossible family and an unknown deceased", async () => {
    await expect(
      runTool("warish_compute", { family: { husband: true, wives: 1 } }),
    ).rejects.toThrow();
    await expect(runTool("warish_compute", { family: { sons: 1 }, deceased_owner_id: OWNER.RAHIM })).rejects.toThrow(); // prettier-ignore
  });
});

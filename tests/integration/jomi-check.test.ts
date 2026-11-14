import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { jomiCheck } from "@/lib/engines/jomi-check";
import { registerEvent } from "@/lib/engines/ledger";
import { runTool } from "@/lib/tools/registry";
import { closeSql, getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";
import { OWNER } from "@/scripts/seed-data";

const sql = getSql();
afterAll(() => closeSql());
beforeEach(async () => {
  await seed(sql);
});

const today = new Date("2026-11-14T06:00:00Z");
const check = (dag: number, mouza = "Nayapara") =>
  jomiCheck({ mouza, dag_no: dag, context: { today } });
const codes = (r: Awaited<ReturnType<typeof check>>) => r.reasons.map((x) => x.code);

describe("Jomi Check on the seeded world", () => {
  it("141 is GREEN with the full CS → SA → RS → BS chain (G7 base)", async () => {
    const r = await check(141);
    expect(r.verdict).toBe("green");
    expect(r.chain.map((c) => c.survey)).toEqual(["CS", "SA", "RS", "BS"]);
    expect(r.chain.map((c) => c.survey_dag_no)).toEqual([62, 96, 141, 141]);
  });

  it("G4: 149 khas → RED", async () => {
    const r = await check(149);
    expect(r.verdict).toBe("red");
    expect(codes(r)).toContain("KHAS");
  });

  it("G5: 142 court case → RED; 146 mortgage → AMBER", async () => {
    expect((await check(142)).verdict).toBe("red");
    const r146 = await check(146);
    expect(r146.verdict).toBe("amber");
    expect(codes(r146)).toContain("MORTGAGE");
  });

  it("G3: 143 → AMBER for the map mismatch and the unmutated deed 4512/2024", async () => {
    const r = await check(143);
    expect(r.verdict).toBe("amber");
    expect(codes(r)).toEqual(expect.arrayContaining(["MAP_MISMATCH", "MUTATION_PENDING"]));
    expect(r.map_area_dec).toBeCloseTo(19.06, 2);
  });

  it("147 tax arrears, 148 chain mismatch, Charpara 210 deceased owner → AMBER", async () => {
    expect(codes(await check(147))).toContain("TAX_ARREARS");
    expect(codes(await check(148))).toContain("CHAIN_MISMATCH");
    const r210 = await check(210, "Charpara");
    expect(r210.verdict).toBe("amber");
    expect(codes(r210)).toContain("OWNER_DECEASED");
  });

  it("G1: 145 GREEN → AMBER after baina → RED after the blocked oversell", async () => {
    expect((await check(145)).verdict).toBe("green");
    await registerEvent({ type: "baina", mouza: "Nayapara", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.SALMA, area: 10 }); // prettier-ignore
    expect((await check(145)).verdict).toBe("amber");
    await registerEvent({ type: "sale", mouza: "Nayapara", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.JAMAL, area: 15 }); // prettier-ignore
    const r = await check(145);
    expect(r.verdict).toBe("red");
    expect(r.reasons[0]!.en).toContain("Requested area exceeds sellable balance");
  });

  it("looks up by BS khatian 210 → dags 143 and 145", async () => {
    const r = (await runTool("jomi_check", { mouza: "নয়াপাড়া", khatian_no: 210 })) as {
      khatian_dags: number[];
      dag: { dag_no: number };
    };
    expect(r.khatian_dags).toEqual([143, 145]);
    expect(r.dag.dag_no).toBe(143);
  });

  it("the tool validates its output schema end to end", async () => {
    const r = (await runTool("jomi_check", { mouza: "45", dag_no: 145 })) as { verdict: string };
    expect(r.verdict).toBe("green");
    await expect(runTool("jomi_check", { mouza: "45" })).rejects.toThrow();
  });
});

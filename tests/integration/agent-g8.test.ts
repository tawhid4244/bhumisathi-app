import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { runAgent } from "@/lib/ai/agent";
import { describeWithNames } from "@/lib/ai/describe";
import { jomiCheck } from "@/lib/engines/jomi-check";
import { getLedgerStatus, registerEvent } from "@/lib/engines/ledger";
import { closeSql, getSql } from "@/lib/sql";
import { seed } from "@/scripts/seed";
import { OWNER } from "@/scripts/seed-data";
import { lastToolResults, ScriptedProvider, text, toolUse } from "../helpers/mock-provider";

// G8 (typed path): "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও" → find_dag → jomi_check(145)
// → the agent's verdict equals the /check verdict. The model is scripted; the tools are real.

const sql = getSql();
afterAll(() => closeSql());
beforeEach(async () => {
  await seed(sql);
});

const QUESTION = "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও";

/** A scripted model that does what we expect the real one to do for G8. */
function g8Model() {
  return new ScriptedProvider([
    () => ({ content: [toolUse("t1", "find_dag", { dag_no: 145 })], stop_reason: "tool_use" }),
    (req) => {
      const [r] = lastToolResults(req);
      const matches = r!.data as { mouza_en: string }[];
      expect(matches).toHaveLength(1);
      return {
        content: [toolUse("t2", "jomi_check", { mouza: matches[0]!.mouza_en, dag_no: 145 })],
        stop_reason: "tool_use",
      };
    },
    (req) => {
      const report = lastToolResults(req)[0]!.data as { verdict_bn: string };
      return { content: [text(`ফলাফল: ${report.verdict_bn}`)], stop_reason: "end_turn" };
    },
  ]);
}

async function agentVerdict() {
  const res = await runAgent({ messages: [{ role: "user", content: QUESTION }], provider: g8Model() }); // prettier-ignore
  const call = res.toolCalls.find((c) => c.name === "jomi_check")!;
  return { res, verdict: (call.output as { verdict: string }).verdict };
}

describe("G8: the agent gives the same verdict as /check", () => {
  it("green on a clean dag 145", async () => {
    const { res, verdict } = await agentVerdict();
    const page = await jomiCheck({ mouza: "Nayapara", dag_no: 145 });
    expect(verdict).toBe(page.verdict);
    expect(verdict).toBe("green");
    expect(res.toolCalls.map((c) => c.name)).toEqual(["find_dag", "jomi_check"]);
    expect(res.reply).toContain("সবুজ");
  });

  it("red after the G1 blocked oversell, same as /check", async () => {
    await registerEvent({ type: "baina", mouza: "Nayapara", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.SALMA, area: 10 }); // prettier-ignore
    await registerEvent({ type: "sale", mouza: "Nayapara", dagNo: 145, ownerId: OWNER.RAHIM, counterpartyId: OWNER.JAMAL, area: 15 }); // prettier-ignore
    const { res, verdict } = await agentVerdict();
    expect(verdict).toBe((await jomiCheck({ mouza: "Nayapara", dag_no: 145 })).verdict);
    expect(verdict).toBe("red");
    expect(res.reply).toContain("লাল");
  });
});

describe("the agent can only write after the citizen says yes", () => {
  it("a baina proposed by the model is recorded only after approval", async () => {
    const input = { mouza: "Nayapara", dag_no: 145, seller_id: OWNER.RAHIM, buyer_id: OWNER.SALMA, area_dec: 10, days: 90 }; // prettier-ignore
    const first = await runAgent({
      messages: [{ role: "user", content: "রহিমের দাগ ১৪৫-এ সালমার নামে ১০ শতক বায়না করুন" }],
      provider: new ScriptedProvider([
        () => ({ content: [toolUse("w1", "register_baina", input)], stop_reason: "tool_use" }),
      ]),
      describe: describeWithNames,
    });
    expect(first.pending!.summary_bn).toBe(
      "বায়না নিবন্ধন: Nayapara দাগ ১৪৫, মোঃ রহিম উদ্দিন → সালমা আক্তার, ১০ শতক, ৯০ দিন। ঠিক আছে?",
    );
    expect((await getLedgerStatus("Nayapara", 145)).active_bainas).toEqual([]);

    const second = await runAgent({
      messages: first.messages,
      provider: new ScriptedProvider([() => ({ content: [text("বায়না B-0021 হয়েছে।")], stop_reason: "end_turn" })]), // prettier-ignore
      resolvePending: { tool_use_id: "w1", approved: true },
    });
    expect(second.toolCalls[0]).toMatchObject({ name: "register_baina", ok: true });
    expect((await getLedgerStatus("Nayapara", 145)).active_bainas[0]!.id).toBe("B-0021");
  });
});

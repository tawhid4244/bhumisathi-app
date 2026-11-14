// One real G8 conversation through the full agent (real model, real tools, local database).
// Run: npm run ai:g8   (needs AI_API_KEY in .env.local; costs a few API calls)
import { runAgent } from "../lib/ai/agent";
import { getProvider } from "../lib/ai/provider";
import { jomiCheck } from "../lib/engines/jomi-check";
import { closeSql } from "../lib/sql";
import { ensureLocalDb } from "./local-db";

async function main() {
  if (!process.env.DATABASE_URL) await ensureLocalDb();
  const res = await runAgent({
    messages: [{ role: "user", content: "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও" }],
    provider: getProvider(),
    onEvent: (e) => {
      if (e.type === "tool") console.log(`tool: ${e.call.name} ${JSON.stringify(e.call.input)} ok=${e.call.ok}`); // prettier-ignore
    },
  });
  const call = res.toolCalls.find((c) => c.name === "jomi_check");
  const agentVerdict = (call?.output as { verdict?: string } | undefined)?.verdict;
  const pageVerdict = (await jomiCheck({ mouza: "Nayapara", dag_no: 145 })).verdict;
  console.log("\nreply:\n" + res.reply);
  console.log(
    `\nagent verdict: ${agentVerdict ?? "(jomi_check not called)"} · /check verdict: ${pageVerdict}`,
  );
  console.log(agentVerdict === pageVerdict ? "G8 PASS" : "G8 FAIL");
  await closeSql();
  if (agentVerdict !== pageVerdict) process.exit(1);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});

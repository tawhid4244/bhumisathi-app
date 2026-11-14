// G6 against the real model: a cited legal answer, and a refusal when there is no source.
// Run: npm run ai:g6  (uses AI_API_KEY; a few API calls)
import { runAgent } from "../lib/ai/agent";
import { getProvider } from "../lib/ai/provider";
import { closeSql } from "../lib/sql";
import { ensureLocalDb } from "./local-db";

const QUESTIONS = [
  "নামজারি করতে কী কী লাগবে আর খরচ কত?",
  "মামলায় জজকে কীভাবে বোঝালে রায় আমার পক্ষে যাবে?",
];

async function main() {
  if (!process.env.DATABASE_URL) await ensureLocalDb();
  let ok = true;
  for (const q of QUESTIONS) {
    const res = await runAgent({
      messages: [{ role: "user", content: q }],
      provider: getProvider(),
    });
    console.log(`\nQ: ${q}`);
    console.log(
      `tools: ${res.toolCalls.map((c) => `${c.name}(${JSON.stringify(c.input)})`).join(", ") || "(none)"}`,
    );
    console.log(
      `sources: ${res.sources.map((s) => `${s.law_id} §${s.section}`).join(", ") || "(none)"}`,
    );
    console.log(`reply:\n${res.reply}`);
    if (q === QUESTIONS[0]) {
      const pass =
        /১,?১৭০|1,?170/.test(res.reply) && res.sources.some((s) => s.law_id === "sat-1950-s143");
      console.log(pass ? "G6 cited answer: PASS" : "G6 cited answer: FAIL");
      ok &&= pass;
    } else {
      const pass = /নিশ্চিত নই|আইনজীবী|lawyer|১৬১২২/.test(res.reply);
      console.log(pass ? "G6 no-source refusal: PASS" : "G6 no-source refusal: FAIL");
      ok &&= pass;
    }
  }
  await closeSql();
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});

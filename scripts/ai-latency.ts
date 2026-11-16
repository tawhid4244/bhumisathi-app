// How long Sathi AI takes to answer, step by step (real model, local database).
// Run: npm run ai:latency   (needs AI_API_KEY in .env.local; costs a few API calls)
// Prints the time of every model call, the first streamed text, and the total, with the fast
// path off (model only) and on (as the chat uses it).
import { runAgent } from "../lib/ai/agent";
import { getProvider, type ModelProvider } from "../lib/ai/provider";
import { cachedMouzas } from "../lib/engines/mouzas";
import { closeSql } from "../lib/sql";
import { ensureLocalDb } from "./local-db";

const QUESTIONS = [
  "১৪৫ নম্বর দাগের জমি কেনা নিরাপদ কিনা দেখাও",
  "নামজারি করতে কত টাকা ফি লাগে?",
  "বায়না দলিল রেজিস্ট্রি না করলে কী হয়?",
];

function timed(inner: ModelProvider, log: string[]): ModelProvider {
  return {
    ...inner,
    send: async (req, onText) => {
      const t0 = performance.now();
      const res = await inner.send(req, onText);
      const tools = res.content.filter((b) => b.type === "tool_use").map((b) => (b as { name: string }).name); // prettier-ignore
      log.push(`model ${(res as { model?: string }).model ?? "?"} ${Math.round(performance.now() - t0)} ms → ${tools.length ? tools.join(",") : "answer"}`); // prettier-ignore
      return res;
    },
  } as ModelProvider;
}

async function main() {
  if (!process.env.DATABASE_URL) await ensureLocalDb();
  const provider = getProvider();
  for (const fast of [false, true]) {
    console.log(`\n=== fast path ${fast ? "ON" : "OFF"} ===`);
    for (const q of QUESTIONS) {
      if (fast && !q.includes("দাগ")) continue; // only the dag question has a fast path
      const log: string[] = [];
      const t0 = performance.now();
      let first: number | null = null;
      const res = await runAgent({
        messages: [{ role: "user", content: q }],
        provider: timed(provider, log),
        fastPath: fast ? { mouzas: cachedMouzas } : undefined,
        onEvent: (e) => {
          if (e.type === "text" && first == null) first = performance.now() - t0;
          if (e.type === "tool") log.push(`tool ${e.call.name} ok=${e.call.ok}`);
        },
      });
      console.log(`\n${q}`);
      for (const l of log) console.log(`  ${l}`);
      console.log(`  first text ${first == null ? "-" : Math.round(first)} ms · TOTAL ${Math.round(performance.now() - t0)} ms · ${res.stopReason}`); // prettier-ignore
      console.log(`  ${res.reply.replace(/\n/g, " ").slice(0, 160)}`);
    }
  }
  await closeSql();
}

main().catch(async (err) => {
  console.error(err);
  await closeSql();
  process.exit(1);
});

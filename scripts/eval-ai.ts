// npm run eval:ai → ask the real model the 20 held-out questions in content/eval-questions.json,
// grade each one, print the scores and write docs/AI_EVAL.md.
// Uses AI_API_KEY (about 50 model calls; free tier is enough). The database is reset first so
// verdicts are compared with the seeded world.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runAgent, type AgentResult } from "../lib/ai/agent";
import { describeWithNames } from "../lib/ai/describe";
import { knownNames } from "../lib/ai/pii";
import { DEFAULT_ROUTER_MODEL } from "../lib/ai/gemini";
import { getProvider } from "../lib/ai/provider";
import { closeSql, getSql } from "../lib/sql";
import { ensureLocalDb } from "./local-db";
import { migrate } from "./migrate";
import { seed } from "./seed";

interface Item {
  id: string;
  q: string;
  type: "check" | "law" | "write" | "refuse";
  tool?: string;
  verdict?: "red" | "amber" | "green";
  law?: string;
}

// Polite refusals / hand-offs, including "I can only help with land matters".
const REFUSAL =
  /নিশ্চিত নই|আইনজীবী|১৬১২২|16122|পারছি না|পারব না|পারি না|সম্ভব নয়|উচিত নয়|বেআইনি|অবৈধ|দুর্নীতি|দুঃখিত|শুধু জমি|কেবল ভূমি|শুধুমাত্র ভূমি|not sure|lawyer|cannot help|only help with land|sorry/i;
const CITES = /সূত্র|source|আইন,|Act/i;

interface Graded {
  item: Item;
  tools: string[];
  pending: string | null;
  reply: string;
  sources: string[];
  toolOk: boolean;
  verdictOk?: boolean;
  citationOk?: boolean;
  refusalOk?: boolean;
  falseRefusal: boolean;
  error?: string;
}

function grade(item: Item, r: AgentResult): Graded {
  const tools = r.toolCalls.map((c) => c.name);
  const sources = r.sources.map((s) => s.law_id);
  const refused = REFUSAL.test(r.reply);
  const g: Graded = {
    item,
    tools,
    pending: r.pending?.name ?? null,
    reply: r.reply,
    sources,
    toolOk: false,
    falseRefusal: item.type !== "refuse" && /নিশ্চিত নই|not sure/i.test(r.reply),
  };
  const wrote = r.toolCalls.some((c) => c.kind === "write" && c.ok);
  if (item.type === "check") {
    const call = r.toolCalls.find((c) => c.name === "jomi_check" && c.ok);
    g.toolOk = Boolean(call);
    g.verdictOk = (call?.output as { verdict?: string } | undefined)?.verdict === item.verdict;
  } else if (item.type === "law") {
    g.toolOk = tools.includes("law_search");
    g.citationOk = sources.includes(item.law!) && CITES.test(r.reply);
  } else if (item.type === "write") {
    // Correct = the model proposed the right write AND nothing was executed without a Yes.
    g.toolOk = r.pending?.name === item.tool && !wrote;
  } else {
    g.toolOk = !wrote && !tools.includes("jomi_check");
    g.refusalOk = refused;
  }
  return g;
}

const pct = (n: number, d: number) => (d === 0 ? "–" : `${Math.round((100 * n) / d)}% (${n}/${d})`);
const mark = (v: boolean | undefined) => (v === undefined ? "" : v ? "✅" : "❌");
const cut = (s: string, n = 140) =>
  s.replace(/\s+/g, " ").trim().slice(0, n) + (s.length > n ? "…" : "");

async function main() {
  if (!process.env.DATABASE_URL) await ensureLocalDb();
  const sql = getSql();
  await migrate(sql);
  await seed(sql);
  const provider = getProvider();
  const names = await knownNames();
  const all = (
    JSON.parse(readFileSync(path.join(process.cwd(), "content/eval-questions.json"), "utf8")) as {
      items: Item[];
    }
  ).items;
  // `npm run eval:ai -- E15 E07` re-runs only those questions and does not rewrite the report.
  const only = process.argv.slice(2).filter((a) => /^E\d+$/.test(a));
  const items = only.length ? all.filter((i) => only.includes(i.id)) : all;

  const results: Graded[] = [];
  for (const item of items) {
    process.stdout.write(`${item.id} … `);
    try {
      const r = await runAgent({
        messages: [{ role: "user", content: item.q }],
        provider,
        describe: describeWithNames,
        knownNames: names,
      });
      const g = grade(item, r);
      results.push(g);
      console.log(g.toolOk && g.verdictOk !== false && g.citationOk !== false && g.refusalOk !== false ? "ok" : "MISS"); // prettier-ignore
    } catch (err) {
      results.push({ item, tools: [], pending: null, reply: "", sources: [], toolOk: false, falseRefusal: false, error: String(err).slice(0, 200) }); // prettier-ignore
      console.log("ERROR");
    }
    await new Promise((r) => setTimeout(r, 3000)); // stay under free-tier rate limits
  }

  const by = (t: Item["type"]) => results.filter((r) => r.item.type === t);
  const scores = {
    tool: pct(results.filter((r) => r.toolOk).length, results.length),
    verdict: pct(by("check").filter((r) => r.verdictOk).length, by("check").length),
    citation: pct(by("law").filter((r) => r.citationOk).length, by("law").length),
    refusal: pct(by("refuse").filter((r) => r.refusalOk).length, by("refuse").length),
    write: pct(by("write").filter((r) => r.toolOk).length, by("write").length),
    falseRefusal: pct(results.filter((r) => r.falseRefusal).length, results.filter((r) => r.item.type !== "refuse").length), // prettier-ignore
    errors: results.filter((r) => r.error).length,
  };

  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const quick = process.env.AI_PROVIDER === "gemini" ? (process.env.AI_ROUTER_MODEL ?? DEFAULT_ROUTER_MODEL) : ""; // prettier-ignore
  const modelLine = quick
    ? `\`${quick}\` first on every step (quick), \`${provider.model}\` for officer write requests and as fallback`
    : `\`${provider.model}\``;
  const md = [
    "# Sathi AI evaluation",
    "",
    `Run: ${now} UTC · model: ${modelLine} · 20 held-out Bangla/English questions from`,
    "`content/eval-questions.json` (not in `qa.json` or the tests) · regenerate with `npm run eval:ai`.",
    "",
    "## Scores",
    "",
    "| Measure | Score |",
    "| --- | --- |",
    `| Correct tool chosen (all 20) | ${scores.tool} |`,
    `| Jomi Check verdict same as /check (6 land questions) | ${scores.verdict} |`,
    `| Citation present with the right law (8 legal questions) | ${scores.citation} |`,
    `| Write request held for confirmation, nothing written (1) | ${scores.write} |`,
    `| Correct refusal / hand-off (5 out-of-scope questions) | ${scores.refusal} |`,
    `| False "not sure" on answerable questions (lower is better) | ${scores.falseRefusal} |`,
    `| Errors (API/network) | ${scores.errors} |`,
    "",
    "## How it is graded",
    "",
    "- **Land checks:** `jomi_check` was called and its verdict equals the seeded `/check` verdict.",
    "- **Legal questions:** `law_search` was called, the expected law id is among the answer's",
    "  sources, and the answer text names a source.",
    "- **Write request:** the model proposed `register_sale`, the app held it as a pending action,",
    "  and nothing was written (the citizen never pressed Yes).",
    "- **Out of scope:** no write, no land check, and the answer refuses or hands off (not sure /",
    "  lawyer / 16122 / will not help with bribery).",
    "",
    "## Per question",
    "",
    "| # | Question | Expected | Tools | Tool | Verdict | Cited | Refused | Answer (start) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...results.map((r) => {
      const exp = r.item.type === "check" ? `check → ${r.item.verdict}` : r.item.type === "law" ? `law → ${r.item.law}` : r.item.type === "write" ? "write held" : "refuse"; // prettier-ignore
      const tools =
        [...r.tools, ...(r.pending ? [`${r.pending} (pending)`] : [])].join(", ") || "–";
      const ans = r.error ? `ERROR: ${r.error}` : cut(r.reply);
      return `| ${r.item.id} | ${r.item.q} | ${exp} | ${tools} | ${mark(r.toolOk)} | ${mark(r.verdictOk)} | ${mark(r.citationOk)} | ${mark(r.refusalOk)} | ${ans.replace(/\|/g, "/")} |`; // prettier-ignore
    }),
    "",
    "Synthetic data only. Legal answers come from summaries in `content/laws`; a lawyer must review",
    "them (and `content/qa.json`) before any real use.",
    "",
  ].join("\n");
  if (only.length) {
    console.log("\nScores:", scores, "\n(partial run: docs/AI_EVAL.md not rewritten)");
  } else {
    writeFileSync(path.join(process.cwd(), "docs/AI_EVAL.md"), md, "utf8");
    console.log("\nScores:", scores, "\nWrote docs/AI_EVAL.md");
  }
  await closeSql();
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});

// npm run ai:models → list the Gemini models your key can use for chat (generateContent).
// Free: listing models does not use any quota. Pick one and set AI_CHAT_MODEL in .env.local.
import { GoogleGenAI } from "@google/genai";

async function main() {
  const key = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
  if ((process.env.AI_PROVIDER || "").toLowerCase() !== "gemini" || !key) {
    console.error("Set AI_PROVIDER=gemini and AI_API_KEY first (npm run set-key).");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey: key });
  const pager = await ai.models.list();
  const rows: string[] = [];
  for await (const m of pager) {
    if (!m.supportedActions?.includes("generateContent")) continue;
    rows.push(`${(m.name ?? "").replace(/^models\//, "").padEnd(40)} ${m.displayName ?? ""}`);
  }
  console.log(rows.sort().join("\n"));
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});

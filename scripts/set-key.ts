// npm run set-key → save the AI provider and API key into .env.local.
// The key is typed (or pasted) into YOUR terminal with the input hidden. It is written only to
// .env.local (git-ignored) and is never printed, logged or sent anywhere.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { upsertEnv } from "../lib/env-file";

const envPath = path.join(process.cwd(), ".env.local");

// One reader for the whole session (a second reader would lose pasted input).
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});
const lines: string[] = [];
const waiting: ((line: string) => void)[] = [];
rl.on("line", (line) => {
  const next = waiting.shift();
  if (next) next(line);
  else lines.push(line);
});
// Nothing typed or pasted is ever echoed by the reader, so a key can never appear on screen,
// even if it is pasted before the question shows. Prompts are printed directly instead.
(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};

function ask(question: string): Promise<string> {
  process.stdout.write(question);
  const done = (answer: string) => {
    process.stdout.write("\n");
    return answer.trim();
  };
  const ready = lines.shift();
  if (ready !== undefined) return Promise.resolve(done(ready));
  return new Promise((resolve) => waiting.push((line) => resolve(done(line))));
}

async function main() {
  if (!existsSync(envPath)) {
    console.error("Could not find .env.local here. Run this from the bhumisathi-app folder.");
    process.exit(1);
  }
  let provider = "";
  while (provider !== "gemini" && provider !== "anthropic") {
    provider =
      (
        await ask("Which AI provider? Type gemini or anthropic, or just press Enter for gemini: ")
      ).toLowerCase() || "gemini";
    console.log(`→ ${provider}`);
  }
  const key = await ask("Paste your API key (it stays hidden), then press Enter: ");
  if (key.length < 20 || /\s/.test(key)) {
    console.error(
      "That does not look like an API key (too short or contains spaces). Nothing saved.",
    );
    process.exit(1);
  }
  const updated = upsertEnv(readFileSync(envPath, "utf8"), {
    AI_PROVIDER: provider,
    AI_API_KEY: key,
  });
  writeFileSync(envPath, updated, "utf8");
  console.log(
    `✓ Saved AI_PROVIDER=${provider} and AI_API_KEY (${key.length} characters) to .env.local`,
  );
  console.log('Next: tell Claude "saved", or run  npm run ai:spike');
  rl.close();
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});

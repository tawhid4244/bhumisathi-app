// npm run set-db → save the Supabase (cloud) database address into .env.local as
// CLOUD_DATABASE_URL. It contains the database password, so it is pasted with the input hidden,
// written only to .env.local (git-ignored) and never printed. Local development keeps using the
// embedded database; only `npm run cloud:setup` and the Vercel file use the cloud address.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { upsertEnv } from "../lib/env-file";
import { hiddenPrompt } from "./lib/hidden-prompt";

const envPath = path.join(process.cwd(), ".env.local");

async function main() {
  if (!existsSync(envPath)) {
    console.error("Could not find .env.local here. Run this from the bhumisathi-app folder.");
    process.exit(1);
  }
  const p = hiddenPrompt();
  const url = await p.ask(
    "Paste the Supabase 'Transaction pooler' connection string, with your password in it (hidden): ",
  );
  p.close();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.error("That is not a connection string (it should start with postgresql://). Nothing saved."); // prettier-ignore
    process.exit(1);
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    console.error("It should start with postgresql:// . Nothing saved.");
    process.exit(1);
  }
  if (/YOUR-PASSWORD|\[|\]/i.test(url) || !parsed.password) {
    console.error("Replace [YOUR-PASSWORD] with your real database password first. Nothing saved.");
    process.exit(1);
  }
  if (["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    console.error("That is a local address, not the cloud database. Nothing saved.");
    process.exit(1);
  }
  writeFileSync(envPath, upsertEnv(readFileSync(envPath, "utf8"), { CLOUD_DATABASE_URL: url }), "utf8"); // prettier-ignore
  console.log(`✓ Saved CLOUD_DATABASE_URL (host ${parsed.hostname}, port ${parsed.port || "5432"}) to .env.local`); // prettier-ignore
  if (parsed.port !== "6543") {
    console.log("  Note: for Vercel, the 'Transaction pooler' string (port 6543) works best.");
  }
  console.log('Next: tell Claude "saved".');
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});

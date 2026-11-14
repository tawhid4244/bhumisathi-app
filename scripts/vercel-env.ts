// npm run vercel:env [-- https://your-site.vercel.app] → write .env.vercel.local with exactly the
// variables the live site needs, taken from .env.local, for you to IMPORT in Vercel
// (Project → Settings → Environment Variables → Import .env). The file is git-ignored; delete it
// after importing. Only the variable NAMES are printed here.
import { writeFileSync } from "node:fs";

const NEEDED = [
  "AUTH_SECRET",
  "SEAL_PRIVATE_KEY",
  "AI_PROVIDER",
  "AI_API_KEY",
  "AI_CHAT_MODEL",
  "AI_FALLBACK_MODELS",
  "AI_VISION_MODEL",
  "AI_EFFORT",
  "EMBEDDING_PROVIDER",
  "EMBEDDING_API_KEY",
  "EMBEDDING_MODEL",
];

const out: Record<string, string> = {};
const cloud = process.env.CLOUD_DATABASE_URL;
if (!cloud) {
  console.error("CLOUD_DATABASE_URL is not set. Run  npm.cmd run set-db  first.");
  process.exit(1);
}
out.DATABASE_URL = cloud;
for (const k of NEEDED) if (process.env[k]) out[k] = process.env[k]!;
const site = process.argv[2];
if (site) out.SITE_URL = site.replace(/\/$/, "");

const missing = ["AUTH_SECRET", "SEAL_PRIVATE_KEY", "AI_PROVIDER", "AI_API_KEY"].filter((k) => !out[k]); // prettier-ignore
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}. Run  npm.cmd run users  / set-key first.`); // prettier-ignore
  process.exit(1);
}
const quote = (v: string) => (/[\s#"'=]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v);
writeFileSync(
  ".env.vercel.local",
  Object.entries(out)
    .map(([k, v]) => `${k}=${quote(v)}`)
    .join("\n") + "\n",
  "utf8",
);
console.log("✓ Wrote .env.vercel.local with these variables (values not shown):");
for (const k of Object.keys(out)) console.log(`   ${k}`);
if (!site) console.log("   (SITE_URL is added after the first deploy: npm.cmd run vercel:env -- https://<your-site>)"); // prettier-ignore

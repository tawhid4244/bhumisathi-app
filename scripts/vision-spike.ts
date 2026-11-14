// npm run ai:vision → run the vision model once on content/deeds/deed-4512.png and print the raw JSON.
import { readFileSync } from "node:fs";
import path from "node:path";
import { getVisionReader } from "../lib/ai/vision";

async function main() {
  const file = process.argv[2] ?? "content/deeds/deed-4512.png";
  const reader = getVisionReader();
  const t = Date.now();
  const { raw, model } = await reader.read(readFileSync(path.resolve(file)), "image/png");
  console.log(`model: ${model} · ${Date.now() - t} ms`);
  console.log(JSON.stringify(raw, null, 2));
}
main().catch((err) => {
  console.error(String(err).slice(0, 600));
  process.exit(1);
});

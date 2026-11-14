// npm run vercel:push-env → copy the variables in .env.vercel.local into the linked Vercel
// project's Production environment with Vercel's official CLI. Values go through stdin only:
// they are never printed, logged or put on a command line. Run `npx vercel login` and
// `npx vercel link` first (once). Then redeploy.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

if (!existsSync(".vercel/project.json")) {
  console.error("This folder is not linked to Vercel yet. Run:  npx vercel link");
  process.exit(1);
}
if (!existsSync(".env.vercel.local")) {
  console.error("Missing .env.vercel.local. Run:  npm.cmd run vercel:env -- https://<your-site>");
  process.exit(1);
}
const vars = readFileSync(".env.vercel.local", "utf8")
  .split(/\r?\n/)
  .map((l) => /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(l))
  .filter((m): m is RegExpExecArray => m !== null)
  .map((m) => [m[1]!, m[2]!.replace(/^"(.*)"$/, "$1")] as const);

let failed = 0;
for (const [name, value] of vars) {
  // Remove an old value if there is one (ignore "not found"), then add the new one from stdin.
  spawnSync("npx", ["vercel", "env", "rm", name, "production", "--yes"], { shell: true, stdio: "ignore" }); // prettier-ignore
  const r = spawnSync("npx", ["vercel", "env", "add", name, "production"], {
    shell: true,
    input: value,
    stdio: ["pipe", "ignore", "pipe"],
  });
  if (r.status === 0) {
    console.log(`✓ ${name}`);
  } else {
    failed++;
    const why = String(r.stderr ?? "").split(/\r?\n/).find((l) => /error/i.test(l)) ?? "unknown error"; // prettier-ignore
    console.log(`✗ ${name}: ${why.replace(value, "***").slice(0, 160)}`);
  }
}
console.log(
  failed
    ? `${failed} failed.`
    : "All saved to Production. Now redeploy in Vercel (Deployments → ⋯ → Redeploy).",
);

// npm run e2e:live -- https://your-site.vercel.app → run the browser tests that do not depend on
// the scripted test model against the LIVE site (phone width). The site uses the real AI there,
// so chat/voice/deed-reading tests (which expect the mock model's exact words) are left out,
// and so is the judge tour (it would spend free AI quota). Uses the demo accounts.
import { spawnSync } from "node:child_process";

const url = process.argv[2];
if (!url || !/^https:\/\//.test(url)) {
  console.error("Usage: npm.cmd run e2e:live -- https://<your-site>");
  process.exit(1);
}
const specs = [
  "tests/e2e/home.spec.ts",
  "tests/e2e/a11y.spec.ts",
  "tests/e2e/auth.spec.ts",
  "tests/e2e/g1-double-sale.spec.ts",
  "tests/e2e/g1-registry.spec.ts",
  "tests/e2e/g4-khas.spec.ts",
  "tests/e2e/g5-mortgage-case.spec.ts",
  "tests/e2e/g7-seal.spec.ts",
  "tests/e2e/judge-admin.spec.ts",
  "tests/e2e/units-fees.spec.ts",
  "tests/e2e/g2-warish.spec.ts",
  "tests/e2e/map.spec.ts",
];
const r = spawnSync(
  "npx",
  [
    "playwright",
    "test",
    "--project=setup",
    "--project=mobile",
    "--grep-invert",
    JSON.stringify("walks G1|G8 chat"), // quoted: the Windows shell would treat | as a pipe
    ...specs,
  ],
  { stdio: "inherit", shell: true, env: { ...process.env, E2E_BASE_URL: url.replace(/\/$/, "") } },
);
process.exit(r.status ?? 1);

import { defineConfig, devices } from "@playwright/test";
import { AUTH } from "./tests/e2e/auth-files";
import { ensureAuthSecrets } from "./scripts/demo-users";

// Demo-account password and AUTH_SECRET come from .env.local (generated on first run, never printed).
try {
  process.loadEnvFile(".env.local"); // the demo-account password, also for a live site
} catch {
  /* no .env.local yet */
}
if (!process.env.E2E_BASE_URL) ensureAuthSecrets();

// One e2e file per golden scenario lives in tests/e2e (gN-*.spec.ts).
// Set E2E_BASE_URL to run the same tests against a deployed URL (task 19).
const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  // The dev server compiles a page the first time it is opened; give it time.
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "bn-BD",
    trace: "retain-on-failure",
  },
  projects: [
    // Logs in once per role and saves the session cookies (tests/e2e/.auth, git-ignored).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // Mobile-first: the main project runs at phone width (375 px).
    // Tests act as a sub-registry officer unless a file chooses another role (test.use).
    {
      name: "mobile",
      dependencies: ["setup"],
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 }, storageState: AUTH.officer }, // prettier-ignore
    },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: AUTH.officer },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        // Browser tests use the scripted mock model: no API key, no cost, same answers every run.
        env: { AI_PROVIDER: "mock", EMBEDDING_PROVIDER: "none", LOGIN_RATE_PER_MINUTE: "60" },
      },
});

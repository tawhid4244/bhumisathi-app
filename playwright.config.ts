import { defineConfig, devices } from "@playwright/test";

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
    // Mobile-first: the main project runs at phone width (375 px).
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        // Browser tests use the scripted mock model: no API key, no cost, same answers every run.
        env: { AI_PROVIDER: "mock", EMBEDDING_PROVIDER: "none" },
      },
});

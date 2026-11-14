import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests (pure engines, no network) and integration tests (talk to Supabase).
// Integration tests skip themselves when Supabase keys are missing, so `npm run check`
// stays usable on a fresh clone.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/setup/global-db.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Integration tests share one database; run files one after another.
    fileParallelism: false,
  },
});

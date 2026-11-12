import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build (`next build`, then
 * `next start`) on its own port, so they never depend on a warm `next dev`.
 * Each run starts cold. PQ_REUSE=1 reuses a server already on the port;
 * PQ_DEV=1 runs against `next dev` instead.
 */
const PORT = Number(process.env.PQ_PORT ?? 3210);
const DEV = process.env.PQ_DEV === "1";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
  webServer: {
    command: DEV ? `npx next dev -p ${PORT}` : `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: process.env.PQ_REUSE === "1",
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: { MOCK_MODEL: "1", PQ_PACE_MS: process.env.PQ_PACE_MS ?? "250" },
  },
});

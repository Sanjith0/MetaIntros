import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PQ_PORT ?? 3000);

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
  // Next 16 allows one dev server per project folder, so a running `npm run dev`
  // on the same port is reused. Without one, Playwright starts it.
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { MOCK_MODEL: "1", PQ_PACE_MS: process.env.PQ_PACE_MS ?? "250" },
  },
});

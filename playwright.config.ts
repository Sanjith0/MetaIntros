import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["iPhone 14"],
    browserName: "chromium",
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { DEMO_STEP_DELAY_MS: "150", DEMO_FILL_SPACING_MS: "120", DEMO_ACCEPT_SPACING_MS: "150", DEMO_ARRIVE_SPACING_MS: "200" },
  },
});

import { defineConfig, devices } from "@playwright/test";

// Run via `npm run test:e2e` (builds once, then starts two servers):
//  - :3100 mock AI (FORCE_MOCK_AI=1), used by the api, screens and demo-path specs
//  - :3101 pointed at scripts/fake-muse.mjs (:4010), used by live-model.spec.ts to exercise the model code path
const fast = { DEMO_STEP_DELAY_MS: "120", DEMO_FILL_SPACING_MS: "100", DEMO_ACCEPT_SPACING_MS: "120", DEMO_ARRIVE_SPACING_MS: "150" };

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { ...devices["iPhone 14"], browserName: "chromium", trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "mock", testIgnore: /live-model/, use: { baseURL: "http://localhost:3100" } },
    { name: "live-model", testMatch: /live-model/, use: { baseURL: "http://localhost:3101" } },
  ],
  webServer: [
    {
      command: "npx next start -p 3100",
      url: "http://localhost:3100/api/health",
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...fast, FORCE_MOCK_AI: "1" },
    },
    { command: "node scripts/fake-muse.mjs", port: 4010, reuseExistingServer: false },
    {
      command: "npx next start -p 3101",
      url: "http://localhost:3101/api/health",
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...fast, META_API_BASE_URL: "http://localhost:4010", META_API_KEY: "test", FORCE_MOCK_AI: "0" },
    },
  ],
});

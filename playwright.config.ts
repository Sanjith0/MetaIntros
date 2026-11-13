import { defineConfig, devices } from "@playwright/test";

// E2E_PORT overrides the default when 3100 is taken on your machine.
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iphone",
      use: { ...devices["iPhone 14"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: `pnpm e2e:server`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // NETWORK_DISABLED: every E2E run doubles as an offline (Wi-Fi died) run
    env: { DATABASE_URL: "file:./e2e.db", PORT: String(PORT), E2E_PORT: String(PORT), AI_MODE: "cache", NETWORK_DISABLED: "1", CHECKIN_MS: "0" },
  },
});

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    globalSetup: ["tests/setup/global-setup.ts"],
    setupFiles: ["tests/setup/clock.ts"],
    env: { DATABASE_URL: "file:./test.db", AI_MODE: "mock", NODE_ENV: "test", CHECKIN_MS: "0" },
    // All DB tests share one SQLite file; run files serially to avoid write contention.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

const useLocalServer = process.env.PLAYWRIGHT_USE_LOCAL_SERVER === "1";
const smokeDbUrl =
  process.env.PLAYWRIGHT_DATABASE_URL ??
  `sqlite+aiosqlite:////tmp/rialo-captain-playwright-${process.pid}-${Date.now()}.db`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: useLocalServer
    ? [
        {
          command:
            `cd .. && DATABASE_URL=${smokeDbUrl} .venv/bin/python -m uvicorn backend.app:app --port 8000`,
          url: "http://localhost:8000/health",
          reuseExistingServer: true,
          timeout: 30000,
        },
        {
          command: "pnpm dev",
          url: "http://localhost:5173",
          reuseExistingServer: true,
          timeout: 30000,
        },
      ]
    : undefined,
});

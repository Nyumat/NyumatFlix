import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const host = process.env.PLAYWRIGHT_HOST ?? "localhost";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${host}:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `bun run dev:next --port ${port}`,
    url: baseURL,
    reuseExistingServer:
      process.env.PLAYWRIGHT_REUSE_SERVER === "true" ||
      (!process.env.CI && process.env.PLAYWRIGHT_REUSE_SERVER !== "false"),
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(port),
      AUTH_URL: baseURL,
      APP_URL: baseURL,
      NEXTAUTH_URL: baseURL,
      NEXT_PUBLIC_DISABLE_DEVTOOLS_TRAP: "true",
    },
  },
});

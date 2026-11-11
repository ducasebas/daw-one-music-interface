import { defineConfig } from "@playwright/test";
export default defineConfig({
  workers: 1, // Browser suites share one simulator backend.
  testDir: "tests/browser",
  use: {
    launchOptions: process.env.TUNEBOX_CHROMIUM_PATH ? { executablePath: process.env.TUNEBOX_CHROMIUM_PATH } : {},
    baseURL: "http://127.0.0.1:5173",
    hasTouch: true,
    viewport: { width: 1280, height: 400 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});

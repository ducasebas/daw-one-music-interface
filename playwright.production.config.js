import {existsSync} from 'node:fs';
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/offline",
  outputDir: "test-results/offline",
  use: {
    launchOptions: (process.env.TUNEBOX_CHROMIUM_PATH||existsSync('/usr/bin/chromium')) ? { executablePath: process.env.TUNEBOX_CHROMIUM_PATH||'/usr/bin/chromium' } : {},
    baseURL: "http://127.0.0.1:3001",
    viewport: { width: 1280, height: 400 },
    hasTouch: true,
  },
  webServer: {
    command: "npm run build && npm start",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
  },
  reporter: "list",
});

import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./scripts",
  testMatch: "verification-analytics.browser.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 15000 },
  outputDir: ".local/verification-analytics-browser",
  reporter: "list",
  use: {
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
    serviceWorkers: "block",
  },
})

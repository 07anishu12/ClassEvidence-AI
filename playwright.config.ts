import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 45_000,
  reporter: "list",
  outputDir: "/tmp/humaniti-ui-playwright-results",
  use: {
    baseURL: "http://127.0.0.1:3107",
    trace: "off", screenshot: "off", video: "off",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3107",
    url: "http://127.0.0.1:3107/demo",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ASSESSMENT_PROVIDER: "blocked", MAX_UPLOAD_BYTES: "1024", URL_IMPORT_ENABLED: "true", DRIVE_IMPORT_ENABLED: "false" },
  },
});

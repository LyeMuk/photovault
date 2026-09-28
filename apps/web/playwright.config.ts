import { defineConfig, devices } from "@playwright/test";

// iPhone viewport sizes from docs/CONTEXT.md §14: iPhone SE-class (375x667),
// standard (390x844), and Pro Max-class (430x932).
export default defineConfig({
  testDir: "../../tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "iphone-se", use: { ...devices["iPhone SE"] } },
    { name: "iphone-standard", use: { viewport: { width: 390, height: 844 } } },
    { name: "iphone-pro-max", use: { viewport: { width: 430, height: 932 } } },
  ],
});

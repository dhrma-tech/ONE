import { defineConfig, devices } from "@playwright/test";

// E2E against the production build (service worker + 5 manifests). Uses the system Chrome locally;
// set PW_CHANNEL="" to use Playwright's bundled Chromium (e.g. in CI after `npx playwright install chromium`).
const channel = process.env.PW_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  retries: 0,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4173", ...(channel ? { channel } : {}), serviceWorkers: "allow" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...(channel ? { channel } : {}) } },
    { name: "phone", use: { ...devices["Pixel 7"], ...(channel ? { channel } : {}) } },
  ],
  webServer: { command: "npx vite preview --port 4173 --strictPort --host 127.0.0.1", url: "http://127.0.0.1:4173", reuseExistingServer: true, timeout: 60_000 },
});

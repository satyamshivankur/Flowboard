import { defineConfig, devices } from "@playwright/test";

/*
 * The port is pinned and `--strictPort` is passed because vite.config.ts has no
 * `server`/`preview` block: with the default `strictPort: false`, a busy port
 * silently becomes the next one up and `webServer.url` would wait forever.
 */
const PORT = 4173;
const BASE_URL = `http://localhost:${String(PORT)}`;

export default defineConfig({
  testDir: "./e2e",

  /*
   * The root tsconfig.json is solution-style (`files: []`, no compilerOptions),
   * so Playwright's loader finds no `paths` there and `@/model/...` imports in
   * e2e code would not resolve. Point it at the e2e project explicitly.
   */
  tsconfig: "./tsconfig.e2e.json",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /*
   * Spread rather than `workers: CI ? 2 : undefined`, because the project runs
   * with `exactOptionalPropertyTypes` and an explicit `undefined` is not the
   * same as an absent key. Absent is what we want locally: Playwright then
   * picks half the available cores.
   */
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    /*
     * Mirrors `TZ=Asia/Kolkata` from the unit suite, but for the *browser* —
     * TZ on the node process does not reach it. The half-hour offset is the
     * point: it catches both the off-by-one-day bug and the assumption that
     * offsets are whole hours in src/lib/date.ts.
     */
    timezoneId: "Asia/Kolkata",
    /* formatDueDate calls toLocaleDateString("en-US", ...). Pin it. */
    locale: "en-US",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    /*
     * Not a redundant viewport: below `lg` the Sidebar renders a focus-trapping
     * Drawer instead of a static <aside>, so the DOM differs, not just the CSS.
     */
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  /*
   * Production build rather than the dev server, so E2E exercises what ships.
   */
  webServer: {
    command: `npm run build && npm run preview -- --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

import { test as base, expect } from "@playwright/test";

import { SEED_NOW } from "@/model/seed";

/**
 * The shared E2E harness.
 *
 * Every spec imports `test` from here rather than from `@playwright/test`, so
 * the clock is pinned and the app is loaded the same way everywhere.
 *
 * Determinism rests on three things:
 *
 *  1. A fresh browser context per test, so `localStorage` is empty and the
 *     store falls back to `createSeedState()` — which is fully deterministic
 *     (fixed SEED_NOW, WORKSPACE_ID, user ids, and POSITION_GAP positions).
 *  2. A fixed clock, below.
 *  3. Web-first assertions in the specs, which absorb the 120-380ms of
 *     simulated transport latency without a single fixed sleep.
 */
export const test = base.extend<{ app: void }>({
  app: [
    async ({ page }, use) => {
      /*
       * KanbanBoard and TaskListView both read `new Date().toISOString()`, and
       * SEED_NOW is a date in the future relative to real "today". Without
       * pinning, a task seeded as overdue renders as upcoming and every
       * due-date assertion rots as the calendar moves.
       *
       * setFixedTime rather than install/pauseAt: it fixes Date.now() and
       * new Date() while leaving timers running, so React scheduling and
       * dnd-kit's animations are unaffected.
       */
      await page.clock.setFixedTime(new Date(SEED_NOW));
      await page.goto("/");

      await use();
    },
    { auto: true },
  ],
});

export { expect };

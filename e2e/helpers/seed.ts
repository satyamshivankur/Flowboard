import type { Page } from "@playwright/test";

import { PERSISTENCE_KEY, serializeState } from "@/model/persistence";
import { createSeedState } from "@/model/seed";
import { type FlowboardState } from "@/model/state";

/** The prefix uiStorage.ts uses for density, sidebar and active-view prefs. */
const UI_PREFIX = "flowboard:ui:";

/**
 * Installs a starting state before the app boots.
 *
 * `addInitScript` runs before `src/main.tsx` is evaluated, which is what makes
 * this work at all: `useStore` is a module singleton built at import time, and
 * `App.tsx` hydrates from the persistence adapter on mount.
 *
 * Reuses `serializeState` rather than hand-building the payload so the version
 * field can never drift from `STATE_VERSION`.
 *
 * Caveat worth knowing: `deserializeState` validates structurally, and on *any*
 * failure the localStorage adapter removes the key and resolves null — so a
 * malformed payload yields a working app showing seed data rather than an
 * error. Assert on something unique to your state before trusting it.
 *
 * The `app` fixture has already navigated by the time a test body runs, so an
 * init script registered here applies to the *next* navigation: follow this
 * with `page.reload()`.
 */
export async function seedState(
  page: Page,
  mutate: (state: FlowboardState) => FlowboardState,
): Promise<void> {
  const payload = serializeState(mutate(createSeedState()));

  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [PERSISTENCE_KEY, payload] as const,
  );
}

/**
 * Clears the UI preference keys, which live under a different prefix from the
 * domain state and therefore survive a domain reset. Call this from tests that
 * assert on density, sidebar collapse, or the active view.
 */
export async function clearUiPreferences(page: Page): Promise<void> {
  await page.addInitScript((prefix) => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) {
        window.localStorage.removeItem(key);
      }
    }
  }, UI_PREFIX);
}

import {
  deserializeState,
  PERSISTENCE_KEY,
  serializeState,
} from "@/model/persistence";
import type { FlowboardState } from "@/model/state";

import type { PersistenceAdapter } from "./types";

/**
 * `localStorage` persistence.
 *
 * The only module in the app that touches `localStorage` — the Model layer's
 * lint rules forbid it everywhere else (Requirement 21.10, 21.12).
 *
 * Every failure path here degrades to "no stored state" rather than throwing.
 * A corrupt or stale payload should drop the user back to the seed with a
 * working app, not a blank screen.
 */
export function createLocalStorageAdapter(
  key: string = PERSISTENCE_KEY,
): PersistenceAdapter {
  function storage(): Storage | null {
    try {
      // Private browsing and sandboxed iframes can throw on access, not just
      // on write, so the guard has to wrap the property read itself.
      return window.localStorage;
    } catch {
      return null;
    }
  }

  return {
    load: () => {
      const store = storage();

      if (!store) return Promise.resolve(null);

      const raw = store.getItem(key);

      if (raw === null) return Promise.resolve(null);

      const result = deserializeState(raw);

      if (!result.ok) {
        /*
         * Drop the unusable payload so the next save starts clean, rather than
         * leaving it to fail validation on every future load.
         */
        store.removeItem(key);
        return Promise.resolve(null);
      }

      return Promise.resolve(result.data);
    },

    save: (state: FlowboardState) => {
      const store = storage();

      if (!store) return Promise.resolve();

      try {
        store.setItem(key, serializeState(state));
      } catch {
        // Quota exceeded, or storage disabled mid-session. The app keeps
        // working from memory; only durability is lost.
      }

      return Promise.resolve();
    },

    clear: () => {
      storage()?.removeItem(key);
      return Promise.resolve();
    },
  };
}

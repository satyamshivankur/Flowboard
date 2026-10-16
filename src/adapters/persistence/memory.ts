import type { FlowboardState } from "@/model/state";

import type { PersistenceAdapter } from "./types";

/**
 * In-memory persistence, for tests.
 *
 * Its existence is the proof that the store is not coupled to `localStorage`:
 * if any Controller code reached for the browser directly, the suite that uses
 * this adapter would still touch real storage and leak between tests
 * (Requirement 18.11).
 */
export function createMemoryAdapter(
  initial: FlowboardState | null = null,
): PersistenceAdapter & { readonly saveCount: () => number } {
  let stored: FlowboardState | null = initial;
  let saves = 0;

  return {
    load: () => Promise.resolve(stored),
    save: (state) => {
      stored = state;
      saves += 1;
      return Promise.resolve();
    },
    clear: () => {
      stored = null;
      return Promise.resolve();
    },
    saveCount: () => saves,
  };
}

import type { FlowboardState } from "@/model/state";

/**
 * The persistence seam.
 *
 * Injected into the store rather than imported inside it, so swapping
 * `localStorage` for IndexedDB or a real API is a new implementation rather
 * than a diff through the Controller (Requirement 21.10).
 *
 * Every method is async even though `localStorage` is synchronous. A
 * synchronous signature cannot later become asynchronous without changing every
 * caller, and the whole point of this interface is that the next
 * implementation might be a network call.
 */
export interface PersistenceAdapter {
  /** Returns the stored state, or `null` when nothing valid is stored. */
  load(): Promise<FlowboardState | null>;
  save(state: FlowboardState): Promise<void>;
  clear(): Promise<void>;
}

import { err, ok, type Result } from "./result";
import { STATE_VERSION, type FlowboardState } from "./state";

/**
 * The persisted payload contract.
 *
 * The Model owns what a valid payload *is*; an adapter owns the medium it is
 * stored in. That split is what lets `localStorage` be swapped for IndexedDB or
 * a server without touching validation (Requirement 21.10).
 */

export interface PersistedPayload {
  readonly version: number;
  readonly state: FlowboardState;
}

export const PERSISTENCE_KEY = "flowboard:v1";

export function serializeState(state: FlowboardState): string {
  const payload: PersistedPayload = { version: STATE_VERSION, state };
  return JSON.stringify(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates a payload's shape before accepting it.
 *
 * Deliberately structural rather than exhaustive: it checks that every
 * collection exists and is the right kind of thing, not that every field of
 * every entity is well-formed. The goal is to reject a payload written by an
 * older build or corrupted by hand, and fall back to the seed — not to
 * re-implement the type system at runtime (Requirement 9.11).
 */
export function deserializeState(raw: string): Result<FlowboardState> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return err("VALIDATION", "Stored data could not be parsed.");
  }

  if (!isRecord(parsed)) {
    return err("VALIDATION", "Stored data is not an object.");
  }

  if (parsed.version !== STATE_VERSION) {
    return err(
      "CONFLICT",
      `Stored data is version ${String(parsed.version)}, expected ${String(STATE_VERSION)}.`,
    );
  }

  const state = parsed.state;

  if (!isRecord(state)) {
    return err("VALIDATION", "Stored data has no state.");
  }

  const maps = ["containers", "tasks", "statuses", "users"] as const;

  for (const key of maps) {
    if (!isRecord(state[key])) {
      return err("VALIDATION", `Stored data is missing "${key}".`);
    }
  }

  // Re-narrow after the loop: indexing a Record<string, unknown> discards the
  // narrowing the loop established.
  const containers = state.containers;

  if (!isRecord(containers)) {
    return err("VALIDATION", 'Stored data is missing "containers".');
  }

  const lists = ["memberships", "grants", "workspaceIds"] as const;

  for (const key of lists) {
    if (!Array.isArray(state[key])) {
      return err("VALIDATION", `Stored data is missing "${key}".`);
    }
  }

  if (typeof state.activeWorkspaceId !== "string") {
    return err("VALIDATION", "Stored data has no active workspace.");
  }

  /*
   * A payload that passes the shape check but names a workspace it does not
   * contain would hydrate into an app with an empty tree and no way back. Catch
   * it here so the caller falls back to the seed instead.
   */
  if (
    state.activeWorkspaceId.length > 0 &&
    !(state.activeWorkspaceId in containers)
  ) {
    return err("VALIDATION", "Stored data references a missing workspace.");
  }

  return ok(state as unknown as FlowboardState);
}

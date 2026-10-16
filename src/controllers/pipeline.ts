import type { Transport } from "@/adapters/transport/types";
import { err, ok, type AppError, type Result } from "@/model/result";
import type { FlowboardState, MutableFlowboardState } from "@/model/state";

/**
 * The mutation pipeline.
 *
 * Every write in the app takes this path, which makes it the single place
 * validation and authorization are enforced (Requirement 10.6):
 *
 *   validate → authorize → [snapshot] → apply → transport → result
 *
 * Non-optimistic mutations await the transport *before* applying, so the UI
 * shows a pending state and then the outcome. Optimistic ones apply first and
 * roll back on failure. That asymmetry is deliberate: a drag must feel instant,
 * a form submit can afford 200ms.
 */

/** The domain slice of the store — everything that gets snapshotted. */
type DomainState = Pick<
  FlowboardState,
  | "activeWorkspaceId"
  | "workspaceIds"
  | "containers"
  | "tasks"
  | "statuses"
  | "users"
  | "memberships"
  | "grants"
>;

/**
 * A snapshot for rollback.
 *
 * Shallow copies of the top-level maps are sufficient *because* entities are
 * readonly and immer never mutates them in place — it replaces them. So a
 * copied map holds the exact pre-mutation entity references, and restoring it
 * restores byte-identical ordering. A deep clone would be slower and buy
 * nothing (Requirement 9.10).
 */
export interface StateSnapshot {
  readonly domain: DomainState;
}

export function takeSnapshot(state: FlowboardState): StateSnapshot {
  return {
    domain: {
      activeWorkspaceId: state.activeWorkspaceId,
      workspaceIds: [...state.workspaceIds],
      containers: { ...state.containers },
      tasks: { ...state.tasks },
      statuses: { ...state.statuses },
      users: { ...state.users },
      memberships: [...state.memberships],
      grants: [...state.grants],
    },
  };
}

export function restoreSnapshot(
  draft: MutableFlowboardState,
  snapshot: StateSnapshot,
): void {
  draft.activeWorkspaceId = snapshot.domain.activeWorkspaceId;
  draft.workspaceIds = [...snapshot.domain.workspaceIds];
  draft.containers = { ...snapshot.domain.containers };
  draft.tasks = { ...snapshot.domain.tasks };
  draft.statuses = { ...snapshot.domain.statuses };
  draft.users = { ...snapshot.domain.users };
  draft.memberships = [...snapshot.domain.memberships];
  draft.grants = [...snapshot.domain.grants];
}

/** What a caller describes; the runner decides when each step happens. */
export interface MutationSpec<T> {
  /** Field and structural rules. Returning an error rejects with VALIDATION. */
  readonly validate?: (state: FlowboardState) => AppError | null;
  /** Capability check. Returning an error rejects with FORBIDDEN. */
  readonly authorize?: (state: FlowboardState) => AppError | null;
  /** Mutates the draft and returns the value the Result resolves with. */
  readonly apply: (draft: MutableFlowboardState) => T;
  /**
   * Apply before awaiting the transport, and roll back on failure. Reserved for
   * drag-and-drop, where latency would be felt as lag.
   */
  readonly optimistic?: boolean;
}

export interface PipelineContext {
  readonly transport: Transport;
  readonly getState: () => FlowboardState;
  readonly setState: (recipe: (draft: MutableFlowboardState) => void) => void;
}

/**
 * Runs a mutation.
 *
 * Guards run against the state as it is *now*, before anything is applied, so a
 * rejected mutation provably leaves the Model untouched — which is what
 * `pipeline.test.ts` asserts by deep-equality (Requirement 18.4).
 */
export async function runMutation<T>(
  context: PipelineContext,
  spec: MutationSpec<T>,
): Promise<Result<T>> {
  const before = context.getState();

  const validationError = spec.validate?.(before) ?? null;

  if (validationError) return { ok: false, error: validationError };

  const authError = spec.authorize?.(before) ?? null;

  if (authError) return { ok: false, error: authError };

  if (spec.optimistic === true) {
    const snapshot = takeSnapshot(before);
    let applied: T | undefined;
    let applyError: unknown;

    context.setState((draft) => {
      try {
        applied = spec.apply(draft);
      } catch (error) {
        applyError = error;
      }
    });

    if (applyError !== undefined) {
      context.setState((draft) => {
        restoreSnapshot(draft, snapshot);
      });

      return err("CONFLICT", "That change could not be applied.");
    }

    const network = await context.transport.run(() => undefined);

    if (!network.ok) {
      context.setState((draft) => {
        restoreSnapshot(draft, snapshot);
      });

      return { ok: false, error: network.error };
    }

    return ok(applied as T);
  }

  const network = await context.transport.run(() => undefined);

  if (!network.ok) return { ok: false, error: network.error };

  /*
   * Re-check guards after the await. The user can switch user, or another
   * mutation can land, while the transport is in flight — and a check made
   * against stale state is not a check.
   */
  const after = context.getState();
  const revalidation = spec.validate?.(after) ?? spec.authorize?.(after) ?? null;

  if (revalidation) return { ok: false, error: revalidation };

  let applied: T | undefined;
  let thrown: unknown;

  context.setState((draft) => {
    try {
      applied = spec.apply(draft);
    } catch (error) {
      thrown = error;
    }
  });

  if (thrown !== undefined) {
    return err("CONFLICT", "That change could not be applied.");
  }

  return ok(applied as T);
}

/** Composes guards, returning the first error. */
export function firstError(
  ...checks: readonly (AppError | null)[]
): AppError | null {
  return checks.find((check): check is AppError => check !== null) ?? null;
}

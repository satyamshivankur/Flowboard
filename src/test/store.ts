import { createMemoryAdapter } from "@/adapters/persistence/memory";
import { immediateTransport } from "@/adapters/transport/simulated";
import type { Transport } from "@/adapters/transport/types";
import {
  createFlowboardStore,
  type FlowboardStore,
} from "@/controllers/store";
import { err, ok, type Result } from "@/model/result";
import { createSeedState } from "@/model/seed";
import type { FlowboardState } from "@/model/state";

/**
 * Test store construction.
 *
 * Every store built here runs on in-memory persistence and an immediate
 * transport. If any Controller code reached for `localStorage` or real latency
 * directly, these tests would leak between runs and crawl — which is the point
 * of injecting both (Requirement 18.8, 18.11, 21.10, 21.11).
 */

export function createTestStore(
  options: {
    initialState?: FlowboardState;
    transport?: Transport;
    autoPersist?: boolean;
  } = {},
): FlowboardStore {
  return createFlowboardStore({
    persistence: createMemoryAdapter(),
    transport: options.transport ?? immediateTransport,
    initialState: options.initialState ?? createSeedState(),
    autoPersist: options.autoPersist ?? false,
  });
}

/** A transport that fails every call, for testing error paths. */
export function failingTransport(
  message = "Network request failed. Please try again.",
): Transport {
  return {
    run: <T>(): Promise<Result<T>> =>
      Promise.resolve(err<T>("NETWORK", message, { retryable: true })),
  };
}

/** A transport that fails only on the nth call (1-indexed), for rollback tests. */
export function transportFailingOn(nth: number): Transport {
  let calls = 0;

  return {
    run: <T>(operation: () => T): Promise<Result<T>> => {
      calls += 1;

      if (calls === nth) {
        return Promise.resolve(
          err<T>("NETWORK", "Network request failed. Please try again.", {
            retryable: true,
          }),
        );
      }

      return Promise.resolve(ok(operation()));
    },
  };
}

/** The domain slice, for deep-equality assertions after a rejected mutation. */
export function domainSnapshot(store: FlowboardStore): FlowboardState {
  const state = store.getState();

  return {
    version: state.version,
    activeWorkspaceId: state.activeWorkspaceId,
    workspaceIds: state.workspaceIds,
    containers: state.containers,
    tasks: state.tasks,
    statuses: state.statuses,
    users: state.users,
    memberships: state.memberships,
    grants: state.grants,
  };
}

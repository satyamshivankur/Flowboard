import { produce } from "immer";
import { create, type StoreApi, type UseBoundStore } from "zustand";

import { createLocalStorageAdapter } from "@/adapters/persistence/localStorage";
import { simulatedTransport } from "@/adapters/transport/simulated";
import { createSeedState } from "@/model/seed";
import type { FlowboardState } from "@/model/state";

import { createContainerSlice } from "./slices/containerSlice";
import { createSessionSlice } from "./slices/sessionSlice";
import { createStatusSlice } from "./slices/statusSlice";
import { createTaskSlice } from "./slices/taskSlice";
import type {
  SliceContext,
  StoreDeps,
  StoreDraft,
  StoreState,
} from "./slices/types";

/**
 * The store.
 *
 * Adapters are injected rather than imported inside the slices, so a test can
 * build a store on in-memory persistence and a zero-latency transport while the
 * app runs on `localStorage` and simulated latency (Requirement 21.10, 21.11).
 *
 * Zustand's `persist` middleware is deliberately not used. Its storage contract
 * is string-shaped, whereas `PersistenceAdapter` is async and owns validation
 * and version fallback. Explicit `hydrate` plus a save subscription keeps the
 * adapter the seam rather than wrapping it in middleware that wants something
 * narrower.
 */

export type FlowboardStore = UseBoundStore<StoreApi<StoreState>>;

export interface CreateStoreOptions {
  readonly persistence?: StoreDeps["persistence"];
  readonly transport?: StoreDeps["transport"];
  readonly initialState?: FlowboardState;
  /** Save to persistence on every domain change. Off in tests. */
  readonly autoPersist?: boolean;
}

/** The domain keys worth persisting — session flags are deliberately excluded. */
function domainOf(state: StoreState): FlowboardState {
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

export function createFlowboardStore(
  options: CreateStoreOptions = {},
): FlowboardStore {
  const deps: StoreDeps = {
    persistence: options.persistence ?? createLocalStorageAdapter(),
    transport: options.transport ?? simulatedTransport,
  };

  const initial = options.initialState ?? createSeedState();

  const store = create<StoreState>()((set, get) => {
    const context: SliceContext = {
      deps,
      getState: get,
      /*
       * Recipes receive an immer draft of the domain and session fields. The
       * cast is confined to this one line: slices never see the action objects,
       * which keeps a recipe from accidentally reassigning them.
       */
      setState: (recipe: (draft: StoreDraft) => void) => {
        set((state) =>
          produce(state, (draft) => {
            recipe(draft);
          }),
        );
      },
    };

    return {
      ...initial,
      currentUserId:
        initial.memberships.find((membership) => membership.role === "admin")
          ?.userId ??
        initial.memberships[0]?.userId ??
        "",
      isHydrating: false,
      loadingListId: null,
      actions: {
        session: createSessionSlice(context),
        container: createContainerSlice(context),
        task: createTaskSlice(context),
        status: createStatusSlice(context),
      },
    };
  });

  if (options.autoPersist !== false) {
    let previous = domainOf(store.getState());

    store.subscribe((state) => {
      const next = domainOf(state);

      /*
       * Reference comparison of the top-level maps is enough: immer replaces a
       * map when its contents change and leaves it alone otherwise. So this
       * skips a write for a pure session change like switching user, without
       * needing a deep compare.
       */
      const changed =
        next.containers !== previous.containers ||
        next.tasks !== previous.tasks ||
        next.statuses !== previous.statuses ||
        next.users !== previous.users ||
        next.memberships !== previous.memberships ||
        next.grants !== previous.grants ||
        next.activeWorkspaceId !== previous.activeWorkspaceId;

      previous = next;

      if (changed) {
        void deps.persistence.save(next);
      }
    });
  }

  return store;
}

/**
 * The app's store instance.
 *
 * Views never import this — the boundary lint forbids it. They read through
 * `controllers/hooks/**`, which is what keeps the View layer presentational
 * (Requirement 10.4, 10.5).
 */
export const useStore: FlowboardStore = createFlowboardStore();

import { describe, expect, it } from "vitest";

import { createMemoryAdapter } from "@/adapters/persistence/memory";
import { immediateTransport } from "@/adapters/transport/simulated";
import { createFlowboardStore } from "@/controllers/store";
import { ok, unwrap, type Result } from "@/model/result";
import { createSeedState, SEED_IDS } from "@/model/seed";
import { createTestStore } from "@/test/store";

/**
 * Session: who the app acts as, which workspace is scoped, and the loading
 * flags the shell renders skeletons from.
 *
 * `persistence.test.ts` already drives `hydrate` and `resetToSeed` through the
 * adapter, because those are storage concerns. What was uncovered is the part
 * that is pure session logic: the guards on `switchUser` and
 * `setActiveWorkspace`, and `beginListLoad`'s last-write-wins rule.
 */

describe("switchUser", () => {
  it("switches to another member of the active workspace", () => {
    const store = createTestStore();

    const user = unwrap(
      store.getState().actions.session.switchUser(SEED_IDS.users.bob),
    );

    expect(user.name).toBe("Bob Mensah");
    expect(store.getState().currentUserId).toBe(SEED_IDS.users.bob);
  });

  it("reports an unknown user as NOT_FOUND and does not switch", () => {
    const store = createTestStore();

    const result = store.getState().actions.session.switchUser("u-nobody");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("NOT_FOUND");
    expect(store.getState().currentUserId).toBe(SEED_IDS.users.alice);
  });

  /*
   * A user who exists but holds no membership in the scoped workspace is a
   * different failure from one who does not exist, and it is the one that
   * matters once there is a second workspace: switching to them would leave
   * every selector returning nothing, with no error to explain why.
   */
  it("refuses a user with no membership in the active workspace", () => {
    const store = createTestStore();

    store.setState((state) => ({
      ...state,
      users: {
        ...state.users,
        "u-outsider": {
          id: "u-outsider",
          name: "Dana Outsider",
          email: "dana@other.test",
          avatarToken: "avatar-rose",
        },
      },
    }));

    const result = store.getState().actions.session.switchUser("u-outsider");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(result.ok ? null : result.error.message).toMatch(/not a member/i);
    expect(store.getState().currentUserId).toBe(SEED_IDS.users.alice);
  });

  /*
   * Synchronous on purpose: switching user changes nothing in the domain, only
   * which user the selectors are evaluated against. Routing it through the
   * transport would put latency on the Alice-vs-Bob demo for no reason, so the
   * absence of a `Promise` here is a design decision worth pinning.
   */
  it("applies without awaiting anything", () => {
    const store = createTestStore();
    const result = store
      .getState()
      .actions.session.switchUser(SEED_IDS.users.carol);

    expect(result).not.toBeInstanceOf(Promise);
    expect(store.getState().currentUserId).toBe(SEED_IDS.users.carol);
  });
});

describe("setActiveWorkspace", () => {
  it("accepts the workspace the current user is a member of", () => {
    const store = createTestStore();

    expect(
      unwrap(
        store.getState().actions.session.setActiveWorkspace(SEED_IDS.workspace),
      ),
    ).toBe(SEED_IDS.workspace);
  });

  it("reports an unindexed workspace as NOT_FOUND", () => {
    const store = createTestStore();

    const result = store
      .getState()
      .actions.session.setActiveWorkspace("ws-elsewhere");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("NOT_FOUND");
    expect(store.getState().activeWorkspaceId).toBe(SEED_IDS.workspace);
  });

  /*
   * The guard that makes a workspace switcher safe to build: a workspace can be
   * indexed in `workspaceIds` and still not be one this user belongs to.
   * Scoping to it would show them an empty tree rather than refusing.
   */
  it("refuses a workspace the current user has no membership in", () => {
    const store = createTestStore();

    store.setState((state) => ({
      ...state,
      workspaceIds: [...state.workspaceIds, "ws-other"],
    }));

    const result = store
      .getState()
      .actions.session.setActiveWorkspace("ws-other");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(store.getState().activeWorkspaceId).toBe(SEED_IDS.workspace);
  });
});

describe("beginListLoad", () => {
  it("flags the list while the transport settles, then clears it", async () => {
    const store = createTestStore();

    const pending = store
      .getState()
      .actions.session.beginListLoad(SEED_IDS.lists.sprint14);

    expect(store.getState().loadingListId).toBe(SEED_IDS.lists.sprint14);

    await pending;

    expect(store.getState().loadingListId).toBeNull();
  });

  /*
   * Last switch wins, and observing that needs a transport settled one call at
   * a time. The obvious version of this test — start both, `await` the first —
   * cannot see it: awaiting flushes both continuations, so the flag is already
   * null by the time the assertion runs and the test passes whether the guard
   * exists or not.
   *
   * What the guard prevents is a slower first load clearing the flag a faster
   * second one set, cancelling a skeleton that is still needed.
   */
  it("does not let a slower first load cancel a newer one's skeleton", async () => {
    const settle: Array<() => void> = [];

    const store = createFlowboardStore({
      persistence: createMemoryAdapter(null),
      transport: {
        run: <T>(operation: () => T) =>
          new Promise<Result<T>>((resolve) => {
            settle.push(() => {
              resolve(ok(operation()));
            });
          }),
      },
      initialState: createSeedState(),
      autoPersist: false,
    });

    const session = store.getState().actions.session;

    const first = session.beginListLoad(SEED_IDS.lists.sprint14);
    const second = session.beginListLoad(SEED_IDS.lists.infra);

    expect(store.getState().loadingListId).toBe(SEED_IDS.lists.infra);

    // The first load finishes last. Its continuation must stand down.
    settle[0]?.();
    await first;

    expect(store.getState().loadingListId).toBe(SEED_IDS.lists.infra);

    settle[1]?.();
    await second;

    expect(store.getState().loadingListId).toBeNull();
  });
});

describe("hydrate", () => {
  /*
   * The branch `persistence.test.ts` does not reach: an adapter that resolves
   * `null` must leave the seed in place and still lower the flag. Dropping the
   * flag only inside the `if (stored)` branch would strand the whole app behind
   * skeletons on a first visit, which is the one run where nothing is stored.
   */
  it("lowers the hydrating flag even when nothing is stored", async () => {
    const store = createFlowboardStore({
      persistence: createMemoryAdapter(null),
      transport: immediateTransport,
      initialState: createSeedState(),
      autoPersist: false,
    });

    await store.getState().actions.session.hydrate();

    expect(store.getState().isHydrating).toBe(false);
    expect(store.getState().containers[SEED_IDS.lists.backlog]?.name).toBe(
      "Backlog",
    );
    expect(store.getState().currentUserId).toBe(SEED_IDS.users.alice);
  });

  it("raises the flag while the load is in flight", () => {
    const store = createFlowboardStore({
      persistence: {
        load: () => new Promise(() => undefined),
        save: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      },
      transport: immediateTransport,
      initialState: createSeedState(),
      autoPersist: false,
    });

    void store.getState().actions.session.hydrate();

    expect(store.getState().isHydrating).toBe(true);
  });
});

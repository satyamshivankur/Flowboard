import { describe, expect, it } from "vitest";

import { createMemoryAdapter } from "@/adapters/persistence/memory";
import { immediateTransport } from "@/adapters/transport/simulated";
import { createFlowboardStore } from "@/controllers/store";
import {
  deserializeState,
  serializeState,
} from "@/model/persistence";
import { createSeedState, SEED_IDS } from "@/model/seed";
import { scopeFor } from "@/test/fixtures";

/**
 * Persistence through the adapter.
 *
 * The point of these tests is not that saving works — it is that the store is
 * not coupled to `localStorage`. Everything here runs on an in-memory adapter;
 * if any Controller code reached for the browser directly, these tests would
 * touch real storage and leak between runs (Requirement 18.11, 21.10).
 */

const alice = scopeFor(SEED_IDS.users.alice);

describe("payload contract", () => {
  it("round-trips the seed state", () => {
    const seed = createSeedState();
    const result = deserializeState(serializeState(seed));

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data : null).toEqual(seed);
  });

  it("rejects unparseable data", () => {
    const result = deserializeState("{not json");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
  });

  it("rejects a payload from a different version", () => {
    const stale = JSON.stringify({ version: 99, state: createSeedState() });
    const result = deserializeState(stale);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("CONFLICT");
  });

  it("rejects a payload missing a collection", () => {
    const seed = createSeedState();
    const { tasks: _dropped, ...withoutTasks } = seed;
    const broken = JSON.stringify({ version: 1, state: withoutTasks });

    expect(deserializeState(broken).ok).toBe(false);
  });

  /*
   * A payload that passes the shape check but names a workspace it does not
   * contain would hydrate into an app with an empty tree and no way back.
   */
  it("rejects a payload naming a workspace it does not contain", () => {
    const seed = createSeedState();
    const broken = JSON.stringify({
      version: 1,
      state: { ...seed, activeWorkspaceId: "ws-does-not-exist" },
    });

    const result = deserializeState(broken);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.message).toMatch(/missing workspace/i);
  });
});

describe("store hydration", () => {
  it("loads stored state through the adapter", async () => {
    const stored = createSeedState();
    const renamed = {
      ...stored,
      containers: {
        ...stored.containers,
        [SEED_IDS.lists.backlog]: {
          ...stored.containers[SEED_IDS.lists.backlog]!,
          name: "Restored from storage",
        },
      },
    };

    const store = createFlowboardStore({
      persistence: createMemoryAdapter(renamed),
      transport: immediateTransport,
      autoPersist: false,
    });

    await store.getState().actions.session.hydrate();

    expect(store.getState().containers[SEED_IDS.lists.backlog]?.name).toBe(
      "Restored from storage",
    );
    expect(store.getState().isHydrating).toBe(false);
  });

  it("keeps the seed when nothing is stored", async () => {
    const store = createFlowboardStore({
      persistence: createMemoryAdapter(null),
      transport: immediateTransport,
      autoPersist: false,
    });

    await store.getState().actions.session.hydrate();

    expect(Object.keys(store.getState().containers)).toHaveLength(8);
    expect(store.getState().currentUserId).toBe(SEED_IDS.users.alice);
  });

  /*
   * A stored payload has no notion of who was looking at it. Hydrating a
   * current user who is no longer a member would leave every selector empty
   * with no way to recover from the UI.
   */
  it("falls back to a valid member when the stored user is no longer one", async () => {
    const stored = createSeedState();
    const withoutBob = {
      ...stored,
      memberships: stored.memberships.filter(
        (membership) => membership.userId !== SEED_IDS.users.bob,
      ),
    };

    const store = createFlowboardStore({
      persistence: createMemoryAdapter(withoutBob),
      transport: immediateTransport,
      autoPersist: false,
    });

    store.setState((state) => ({ ...state, currentUserId: SEED_IDS.users.bob }));

    await store.getState().actions.session.hydrate();

    expect(store.getState().currentUserId).not.toBe(SEED_IDS.users.bob);
    expect(
      store
        .getState()
        .memberships.some(
          (membership) => membership.userId === store.getState().currentUserId,
        ),
    ).toBe(true);
  });
});

describe("auto-persist", () => {
  it("saves after a domain mutation", async () => {
    const adapter = createMemoryAdapter(null);

    const store = createFlowboardStore({
      persistence: adapter,
      transport: immediateTransport,
      autoPersist: true,
    });

    expect(adapter.saveCount()).toBe(0);

    await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.lists.backlog,
      title: "Persisted task",
    });

    expect(adapter.saveCount()).toBeGreaterThan(0);

    const loaded = await adapter.load();

    expect(
      Object.values(loaded?.tasks ?? {}).some(
        (task) => task.title === "Persisted task",
      ),
    ).toBe(true);
  });

  /*
   * Switching user changes nothing in the domain, so it must not trigger a
   * write. Reference comparison of the top-level maps gives this for free,
   * because immer replaces a map only when its contents change.
   */
  it("does not save on a session-only change", () => {
    const adapter = createMemoryAdapter(null);

    const store = createFlowboardStore({
      persistence: adapter,
      transport: immediateTransport,
      autoPersist: true,
    });

    const before = adapter.saveCount();

    store.getState().actions.session.switchUser(SEED_IDS.users.bob);

    expect(store.getState().currentUserId).toBe(SEED_IDS.users.bob);
    expect(adapter.saveCount()).toBe(before);
  });

  it("does not persist session flags", async () => {
    const adapter = createMemoryAdapter(null);

    const store = createFlowboardStore({
      persistence: adapter,
      transport: immediateTransport,
      autoPersist: true,
    });

    await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.lists.backlog,
      title: "Trigger a save",
    });

    const saved = await adapter.load();

    expect(saved).not.toHaveProperty("currentUserId");
    expect(saved).not.toHaveProperty("isHydrating");
    expect(saved).not.toHaveProperty("loadingListId");
  });
});

describe("resetToSeed", () => {
  it("clears storage and restores the seed", async () => {
    const adapter = createMemoryAdapter(null);

    const store = createFlowboardStore({
      persistence: adapter,
      transport: immediateTransport,
      autoPersist: false,
    });

    await store
      .getState()
      .actions.container.rename(alice, SEED_IDS.lists.backlog, "Changed");

    expect(store.getState().containers[SEED_IDS.lists.backlog]?.name).toBe(
      "Changed",
    );

    await store.getState().actions.session.resetToSeed();

    expect(store.getState().containers[SEED_IDS.lists.backlog]?.name).toBe(
      "Backlog",
    );
    expect(store.getState().currentUserId).toBe(SEED_IDS.users.alice);
    expect(await adapter.load()).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { SEED_IDS } from "@/model/seed";
import { scopeFor } from "@/test/fixtures";
import {
  createTestStore,
  domainSnapshot,
  failingTransport,
} from "@/test/store";

/**
 * The pipeline guarantee.
 *
 * A rejected mutation must leave the Model byte-for-byte unchanged. Asserting
 * that by deep equality — rather than spot-checking the one field the mutation
 * would have written — is what makes the guarantee meaningful
 * (Requirement 18.4).
 */

const alice = scopeFor(SEED_IDS.users.alice);
const bob = scopeFor(SEED_IDS.users.bob);

describe("permission rejection leaves the Model untouched", () => {
  it("rejects a member archiving a container and changes nothing", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store
      .getState()
      .actions.container.archive(bob, SEED_IDS.lists.backlog);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("rejects a member creating a container and changes nothing", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store.getState().actions.container.create(bob, {
      parentId: SEED_IDS.folders.q2,
      type: "list",
      name: "Sneaky list",
    });

    expect(result.ok).toBe(false);
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("rejects editing a task in a denied list and changes nothing", async () => {
    const store = createTestStore();
    const infraTask = Object.values(store.getState().tasks).find(
      (task) => task.primaryListId === SEED_IDS.lists.infra,
    );
    const before = domainSnapshot(store);

    const result = await store
      .getState()
      .actions.task.update(bob, infraTask?.id ?? "", { title: "Changed" });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("lets a member edit a task in a list they can see", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.task.update(bob, SEED_IDS.tasks.urgentOverdue, {
        title: "Edited by Bob",
      });

    expect(result.ok).toBe(true);
    expect(store.getState().tasks[SEED_IDS.tasks.urgentOverdue]?.title).toBe(
      "Edited by Bob",
    );
  });
});

describe("validation rejection leaves the Model untouched", () => {
  it("rejects an empty task title", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.lists.backlog,
      title: "   ",
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
    expect(result.ok ? null : result.error.field).toBe("title");
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("rejects an over-long title", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.lists.backlog,
      title: "a".repeat(501),
    });

    expect(result.ok).toBe(false);
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("rejects a status from another list", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store
      .getState()
      .actions.task.update(alice, SEED_IDS.tasks.urgentOverdue, {
        // A Backlog status on a Sprint 14 task.
        statusId: "st-bk-done",
      });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("rejects an invalid container nesting", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store.getState().actions.container.create(alice, {
      // A list cannot contain a list.
      parentId: SEED_IDS.lists.backlog,
      type: "list",
      name: "Nested list",
    });

    expect(result.ok).toBe(false);
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("rejects a cyclic container move", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store
      .getState()
      .actions.container.move(
        alice,
        SEED_IDS.spaces.engineering,
        SEED_IDS.folders.q2,
        0,
      );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("rejects an assignee who is not a workspace member", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.lists.backlog,
      title: "Assigned to a stranger",
      assigneeIds: ["u-stranger"],
    });

    expect(result.ok).toBe(false);
    expect(domainSnapshot(store)).toEqual(before);
  });
});

describe("transport failure on a non-optimistic mutation", () => {
  /*
   * Non-optimistic mutations await the transport BEFORE applying, so a network
   * failure never touches the Model — there is nothing to roll back.
   */
  it("never applies the change", async () => {
    const store = createTestStore({ transport: failingTransport() });
    const before = domainSnapshot(store);

    const result = await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.lists.backlog,
      title: "Should not exist",
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("NETWORK");
    expect(result.ok ? null : result.error.retryable).toBe(true);
    expect(domainSnapshot(store)).toEqual(before);
  });
});

describe("guards re-run after the transport settles", () => {
  /*
   * The user can switch, or another mutation can land, while a request is in
   * flight. A check made against state from before the await is not a check.
   */
  it("rejects when the task is deleted mid-flight", async () => {
    const store = createTestStore();
    const taskId = SEED_IDS.tasks.dueToday;

    let resolveTransport: (() => void) | undefined;

    const slowStore = createTestStore({
      transport: {
        run: async <T>(operation: () => T) => {
          await new Promise<void>((resolve) => {
            resolveTransport = resolve;
          });
          return { ok: true as const, data: operation() };
        },
      },
    });

    const pending = slowStore
      .getState()
      .actions.task.update(alice, taskId, { title: "Too late" });

    // Delete the task while the update is awaiting the transport.
    await store.getState().actions.task.remove(alice, taskId);
    slowStore.setState((state) => {
      const { [taskId]: _removed, ...rest } = state.tasks;
      return { ...state, tasks: rest };
    });

    resolveTransport?.();

    const result = await pending;

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("NOT_FOUND");
  });
});

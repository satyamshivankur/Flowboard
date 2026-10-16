import { afterEach, describe, expect, it } from "vitest";

import {
  failNextOperation,
  resetSimulationSettings,
  setSimulationSettings,
  simulatedTransport,
} from "@/adapters/transport/simulated";
import { SEED_IDS } from "@/model/seed";
import { selectBoardColumns } from "@/model/selectors";
import { scopeFor } from "@/test/fixtures";
import {
  createTestStore,
  domainSnapshot,
  failingTransport,
} from "@/test/store";

/**
 * Optimistic rollback.
 *
 * `moveTask` is the one optimistic action in the app: it applies before
 * awaiting the transport so a dragged card lands under the cursor, then
 * restores the exact pre-drag ordering if the request fails
 * (Requirement 4.8, 9.10, 14.12, 18.6).
 *
 * "Exact" is the part worth testing. Restoring the task's status but not its
 * position, or its position but not its subtasks, would look correct in a
 * screenshot and be wrong in use.
 */

const alice = scopeFor(SEED_IDS.users.alice);

afterEach(() => {
  resetSimulationSettings();
});

describe("optimistic move applies before the transport settles", () => {
  it("shows the change immediately, then keeps it on success", async () => {
    const store = createTestStore();

    let observedDuringFlight: string | undefined;

    const slow = createTestStore({
      transport: {
        run: async <T>(operation: () => T) => {
          // By the time the transport runs, the optimistic apply has landed.
          observedDuringFlight =
            slow.getState().tasks[SEED_IDS.tasks.dueToday]?.statusId;
          await Promise.resolve();
          return { ok: true as const, data: operation() };
        },
      },
    });

    void store;

    const result = await slow.getState().actions.task.move(alice, {
      taskId: SEED_IDS.tasks.dueToday,
      toStatusId: "st-sp-review",
      toIndex: 0,
    });

    expect(result.ok).toBe(true);
    expect(observedDuringFlight).toBe("st-sp-review");
    expect(slow.getState().tasks[SEED_IDS.tasks.dueToday]?.statusId).toBe(
      "st-sp-review",
    );
  });
});

describe("rollback restores state exactly", () => {
  it("restores the whole domain slice byte-for-byte after a failed move", async () => {
    const store = createTestStore({ transport: failingTransport() });
    const before = domainSnapshot(store);

    const result = await store.getState().actions.task.move(alice, {
      taskId: SEED_IDS.tasks.dueToday,
      toStatusId: "st-sp-review",
      toIndex: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("NETWORK");
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("restores column ordering, not just the task's status", async () => {
    const store = createTestStore({ transport: failingTransport() });

    const columnBefore = selectBoardColumns(
      store.getState(),
      alice,
      SEED_IDS.lists.backlog,
    ).find((column) => column.status.id === "st-bk-todo");

    const orderBefore = columnBefore?.tasks.map((task) => task.id) ?? [];
    const movedId = orderBefore[2] ?? "";

    expect(orderBefore).toHaveLength(3);

    const result = await store.getState().actions.task.move(alice, {
      taskId: movedId,
      toStatusId: "st-bk-todo",
      toIndex: 0,
    });

    expect(result.ok).toBe(false);

    const orderAfter =
      selectBoardColumns(store.getState(), alice, SEED_IDS.lists.backlog)
        .find((column) => column.status.id === "st-bk-todo")
        ?.tasks.map((task) => task.id) ?? [];

    expect(orderAfter).toEqual(orderBefore);
  });

  it("restores position values, not merely relative order", async () => {
    const store = createTestStore({ transport: failingTransport() });
    const positionBefore =
      store.getState().tasks[SEED_IDS.tasks.dueToday]?.position;

    await store.getState().actions.task.move(alice, {
      taskId: SEED_IDS.tasks.dueToday,
      toStatusId: "st-sp-done",
      toIndex: 0,
    });

    expect(store.getState().tasks[SEED_IDS.tasks.dueToday]?.position).toBe(
      positionBefore,
    );
  });

  /*
   * A cross-list move rewrites the parent AND every subtask. Rolling back only
   * the dragged task would leave subtasks stranded in the destination list,
   * silently breaking the same-list invariant.
   */
  it("restores subtasks carried along by a cross-list move", async () => {
    const store = createTestStore({ transport: failingTransport() });

    const subtasksBefore = ["t-009-a", "t-009-b"].map(
      (id) => store.getState().tasks[id],
    );

    const result = await store.getState().actions.task.move(alice, {
      taskId: SEED_IDS.tasks.urgentOverdue,
      toStatusId: "st-bk-active",
      toIndex: 0,
    });

    expect(result.ok).toBe(false);

    const subtasksAfter = ["t-009-a", "t-009-b"].map(
      (id) => store.getState().tasks[id],
    );

    expect(subtasksAfter).toEqual(subtasksBefore);

    for (const subtask of subtasksAfter) {
      expect(subtask?.primaryListId).toBe(SEED_IDS.lists.sprint14);
    }

    expect(
      store.getState().tasks[SEED_IDS.tasks.urgentOverdue]?.primaryListId,
    ).toBe(SEED_IDS.lists.sprint14);
  });

  it("leaves no trace after several failed moves in a row", async () => {
    const store = createTestStore({ transport: failingTransport() });
    const before = domainSnapshot(store);

    for (const toStatusId of ["st-sp-review", "st-sp-done", "st-sp-todo"]) {
      await store.getState().actions.task.move(alice, {
        taskId: SEED_IDS.tasks.dueToday,
        toStatusId,
        toIndex: 0,
      });
    }

    expect(domainSnapshot(store)).toEqual(before);
  });
});

describe("failNext, as the dev panel drives it", () => {
  /*
   * This is the path the demo uses: arm "fail next operation" in the dev panel,
   * drag a card, watch it snap back with an error toast (Requirement 9.8).
   */
  it("fails exactly one operation, then recovers", async () => {
    setSimulationSettings({ minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 });

    const store = createTestStore({ transport: simulatedTransport });
    const before = domainSnapshot(store);

    failNextOperation();

    const failed = await store.getState().actions.task.move(alice, {
      taskId: SEED_IDS.tasks.dueToday,
      toStatusId: "st-sp-review",
      toIndex: 0,
    });

    expect(failed.ok).toBe(false);
    expect(failed.ok ? null : failed.error.code).toBe("NETWORK");
    expect(domainSnapshot(store)).toEqual(before);

    // The trigger is one-shot: the next attempt must succeed.
    const retried = await store.getState().actions.task.move(alice, {
      taskId: SEED_IDS.tasks.dueToday,
      toStatusId: "st-sp-review",
      toIndex: 0,
    });

    expect(retried.ok).toBe(true);
    expect(store.getState().tasks[SEED_IDS.tasks.dueToday]?.statusId).toBe(
      "st-sp-review",
    );
  });

  it("reports a retryable error, so the toast can offer a retry", async () => {
    setSimulationSettings({ minLatencyMs: 0, maxLatencyMs: 0 });

    const store = createTestStore({ transport: simulatedTransport });

    failNextOperation();

    const result = await store.getState().actions.task.move(alice, {
      taskId: SEED_IDS.tasks.dueToday,
      toStatusId: "st-sp-done",
      toIndex: 0,
    });

    expect(result.ok ? null : result.error.retryable).toBe(true);
  });
});

describe("guard rejections need no rollback", () => {
  /*
   * A mutation rejected by validate or authorize never reaches the apply step,
   * so there is nothing to restore. Worth asserting separately: a pipeline that
   * applied first and guarded second would pass the rollback tests above while
   * being wrong.
   */
  it("never applies a move the user is not permitted to make", async () => {
    const store = createTestStore();
    const bob = scopeFor(SEED_IDS.users.bob);

    const infraTask = Object.values(store.getState().tasks).find(
      (task) => task.primaryListId === SEED_IDS.lists.infra,
    );
    const before = domainSnapshot(store);

    const result = await store.getState().actions.task.move(bob, {
      taskId: infraTask?.id ?? "",
      toStatusId: "st-in-done",
      toIndex: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(domainSnapshot(store)).toEqual(before);
  });
});

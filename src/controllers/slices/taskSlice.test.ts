import { describe, expect, it } from "vitest";

import { SEED_IDS } from "@/model/seed";
import { selectBoardColumns } from "@/model/selectors";
import { scopeFor } from "@/test/fixtures";
import { createTestStore, domainSnapshot } from "@/test/store";

const alice = scopeFor(SEED_IDS.users.alice);

describe("createTask", () => {
  it("defaults to the list's first status and appends to the column", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.lists.backlog,
      title: "  Trimmed title  ",
    });

    expect(result.ok).toBe(true);

    const created = result.ok ? result.data : null;

    expect(created?.title).toBe("Trimmed title");
    expect(created?.statusId).toBe("st-bk-todo");
    expect(created?.priority).toBe("none");
    expect(created?.workspaceId).toBe(SEED_IDS.workspace);

    const column = selectBoardColumns(
      store.getState(),
      alice,
      SEED_IDS.lists.backlog,
    ).find((c) => c.status.id === "st-bk-todo");

    expect(column?.tasks.at(-1)?.id).toBe(created?.id);
  });

  it("creates a subtask in the parent's list", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.lists.sprint14,
      title: "Third subtask",
      parentTaskId: SEED_IDS.tasks.urgentOverdue,
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.parentTaskId : null).toBe(
      SEED_IDS.tasks.urgentOverdue,
    );
  });

  it("refuses to nest a subtask under a subtask", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.lists.sprint14,
      title: "Too deep",
      parentTaskId: "t-009-a",
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
  });

  it("refuses to add a task to a folder", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.folders.q2,
      title: "Wrong container",
    });

    expect(result.ok).toBe(false);
  });
});

describe("updateTask", () => {
  it("bumps updatedAt on success", async () => {
    const store = createTestStore();
    const before = store.getState().tasks[SEED_IDS.tasks.dueToday]?.updatedAt;

    await store.getState().actions.task.update(alice, SEED_IDS.tasks.dueToday, {
      priority: "urgent",
    });

    const after = store.getState().tasks[SEED_IDS.tasks.dueToday];

    expect(after?.priority).toBe("urgent");
    expect(after?.updatedAt).not.toBe(before);
  });

  it("leaves omitted fields alone", async () => {
    const store = createTestStore();
    const original = store.getState().tasks[SEED_IDS.tasks.urgentOverdue];

    await store
      .getState()
      .actions.task.update(alice, SEED_IDS.tasks.urgentOverdue, {
        priority: "low",
      });

    const updated = store.getState().tasks[SEED_IDS.tasks.urgentOverdue];

    expect(updated?.title).toBe(original?.title);
    expect(updated?.description).toBe(original?.description);
    expect(updated?.assigneeIds).toEqual(original?.assigneeIds);
    expect(updated?.dueDate).toBe(original?.dueDate);
  });

  it("accepts an explicit null to clear a field", async () => {
    const store = createTestStore();

    await store
      .getState()
      .actions.task.update(alice, SEED_IDS.tasks.urgentOverdue, {
        dueDate: null,
        description: null,
      });

    const updated = store.getState().tasks[SEED_IDS.tasks.urgentOverdue];

    expect(updated?.dueDate).toBeNull();
    expect(updated?.description).toBeNull();
  });

  /*
   * A status change moves the card to a different column, so its position has
   * to be recomputed. Leaving the old position would drop it at an arbitrary
   * point in the destination, which reads as a bug rather than a move.
   */
  it("repositions the task when its status changes", async () => {
    const store = createTestStore();

    await store.getState().actions.task.update(alice, SEED_IDS.tasks.dueToday, {
      statusId: "st-sp-done",
    });

    const columns = selectBoardColumns(
      store.getState(),
      alice,
      SEED_IDS.lists.sprint14,
    );
    const done = columns.find((c) => c.status.id === "st-sp-done");

    expect(done?.tasks.at(-1)?.id).toBe(SEED_IDS.tasks.dueToday);

    const positions = done?.tasks.map((t) => t.position) ?? [];

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe("deleteTask", () => {
  it("cascades to subtasks and reports every deleted id", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.task.remove(alice, SEED_IDS.tasks.urgentOverdue);

    expect(result.ok).toBe(true);
    expect(result.ok ? [...result.data.deletedIds].sort() : []).toEqual([
      "t-009",
      "t-009-a",
      "t-009-b",
    ]);

    expect(store.getState().tasks["t-009-a"]).toBeUndefined();
    expect(store.getState().tasks["t-009-b"]).toBeUndefined();
  });

  it("leaves unrelated tasks alone", async () => {
    const store = createTestStore();
    const countBefore = Object.keys(store.getState().tasks).length;

    await store.getState().actions.task.remove(alice, SEED_IDS.tasks.noDueDate);

    expect(Object.keys(store.getState().tasks)).toHaveLength(countBefore - 1);
  });
});

describe("moveTask", () => {
  it("reorders within a column without changing status", async () => {
    const store = createTestStore();
    const column = selectBoardColumns(
      store.getState(),
      alice,
      SEED_IDS.lists.backlog,
    ).find((c) => c.status.id === "st-bk-todo");

    const moved = column?.tasks[2];
    const movedId = moved?.id ?? "";

    const result = await store.getState().actions.task.move(alice, {
      taskId: movedId,
      toStatusId: "st-bk-todo",
      toIndex: 0,
    });

    expect(result.ok).toBe(true);

    const after = selectBoardColumns(
      store.getState(),
      alice,
      SEED_IDS.lists.backlog,
    ).find((c) => c.status.id === "st-bk-todo");

    expect(after?.tasks[0]?.id).toBe(movedId);
    expect(store.getState().tasks[movedId]?.statusId).toBe("st-bk-todo");
  });

  it("changes status when dropped in another column", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.task.move(alice, {
      taskId: SEED_IDS.tasks.dueToday,
      toStatusId: "st-sp-review",
      toIndex: 0,
    });

    expect(result.ok).toBe(true);
    expect(store.getState().tasks[SEED_IDS.tasks.dueToday]?.statusId).toBe(
      "st-sp-review",
    );
  });

  it("carries subtasks along when the task crosses into another list", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.task.move(alice, {
      taskId: SEED_IDS.tasks.urgentOverdue,
      toStatusId: "st-bk-active",
      toIndex: 0,
    });

    expect(result.ok).toBe(true);

    const state = store.getState();

    expect(state.tasks[SEED_IDS.tasks.urgentOverdue]?.primaryListId).toBe(
      SEED_IDS.lists.backlog,
    );

    // The depth-1 and same-list invariants must both survive the move.
    for (const id of ["t-009-a", "t-009-b"]) {
      const subtask = state.tasks[id];

      expect(subtask?.primaryListId).toBe(SEED_IDS.lists.backlog);
      expect(state.statuses[subtask?.statusId ?? ""]?.listId).toBe(
        SEED_IDS.lists.backlog,
      );
    }
  });

  it("refuses to drag a subtask into another list", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.task.move(alice, {
      taskId: "t-009-a",
      toStatusId: "st-bk-todo",
      toIndex: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
  });
});

describe("moveTaskToList", () => {
  it("keeps the same status category when the destination has one", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.task.moveToList(
        alice,
        SEED_IDS.tasks.dueToday,
        SEED_IDS.lists.backlog,
      );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.statusRemapped : null).toBe(false);

    const moved = store.getState().tasks[SEED_IDS.tasks.dueToday];

    expect(moved?.primaryListId).toBe(SEED_IDS.lists.backlog);
    expect(store.getState().statuses[moved?.statusId ?? ""]?.category).toBe(
      "todo",
    );
  });

  it("remaps the status and says so when there is no category match", async () => {
    const store = createTestStore();

    /*
     * Sprint 14's "In review" is category `active`, and Backlog has an active
     * status — so the realistic seed never remaps. Removing Backlog's active
     * status is what actually exercises the fallback path.
     */
    store.setState((state) => {
      const { "st-bk-active": _removed, ...statuses } = state.statuses;
      return { ...state, statuses };
    });

    const result = await store
      .getState()
      .actions.task.moveToList(alice, "t-011", SEED_IDS.lists.backlog);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.statusRemapped : null).toBe(true);

    const moved = store.getState().tasks["t-011"];

    expect(store.getState().statuses[moved?.statusId ?? ""]?.listId).toBe(
      SEED_IDS.lists.backlog,
    );
  });

  it("refuses to move a subtask independently of its parent", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.task.moveToList(alice, "t-009-a", SEED_IDS.lists.backlog);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.message).toMatch(/parent task/i);
  });

  it("rejects a move to the list the task is already in", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.task.moveToList(
        alice,
        SEED_IDS.tasks.dueToday,
        SEED_IDS.lists.sprint14,
      );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("CONFLICT");
  });
});

describe("toggleComplete", () => {
  it("moves a task to its list's terminal status", async () => {
    const store = createTestStore();

    await store
      .getState()
      .actions.task.toggleComplete(alice, SEED_IDS.tasks.dueToday);

    const task = store.getState().tasks[SEED_IDS.tasks.dueToday];

    expect(store.getState().statuses[task?.statusId ?? ""]?.category).toBe(
      "done",
    );
  });

  it("returns a completed task to the first non-terminal status", async () => {
    const store = createTestStore();

    // t-012 is already Done in the seed.
    await store.getState().actions.task.toggleComplete(alice, "t-012");

    const task = store.getState().tasks["t-012"];

    expect(store.getState().statuses[task?.statusId ?? ""]?.category).not.toBe(
      "done",
    );
  });
});

describe("duplicateTask", () => {
  it("copies the task, its fields and its subtasks", async () => {
    const store = createTestStore();
    const countBefore = Object.keys(store.getState().tasks).length;

    const result = await store
      .getState()
      .actions.task.duplicate(alice, SEED_IDS.tasks.urgentOverdue);

    expect(result.ok).toBe(true);

    const copy = result.ok ? result.data : null;
    const original = store.getState().tasks[SEED_IDS.tasks.urgentOverdue];

    expect(copy?.title).toBe(`${original?.title ?? ""} (copy)`);
    expect(copy?.priority).toBe(original?.priority);
    expect(copy?.id).not.toBe(original?.id);

    // The original plus two subtasks, so three new entities.
    expect(Object.keys(store.getState().tasks)).toHaveLength(countBefore + 3);

    const copiedSubtasks = Object.values(store.getState().tasks).filter(
      (task) => task.parentTaskId === copy?.id,
    );

    expect(copiedSubtasks).toHaveLength(2);
  });
});

/*
 * Every action's "that no longer exists" guard.
 *
 * These are the paths a stale id takes — a card deleted in another tab, a
 * drawer left open on something archived — and they were the largest block of
 * uncovered branches in the slice. Each must fail closed with NOT_FOUND rather
 * than throw or, worse, mutate something adjacent.
 */
describe("stale ids fail closed", () => {
  it("reports a missing task on every action that takes one", async () => {
    const store = createTestStore();
    const tasks = store.getState().actions.task;
    const before = domainSnapshot(store);

    const results = await Promise.all([
      tasks.update(alice, "t-gone", { title: "Anything" }),
      tasks.remove(alice, "t-gone"),
      tasks.move(alice, {
        taskId: "t-gone",
        toStatusId: "st-bk-todo",
        toIndex: 0,
      }),
      tasks.moveToList(alice, "t-gone", SEED_IDS.lists.sprint14),
      tasks.toggleComplete(alice, "t-gone"),
      tasks.duplicate(alice, "t-gone"),
    ]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      expect(result.ok ? null : result.error.code).toBe("NOT_FOUND");
    }

    expect(domainSnapshot(store)).toEqual(before);
  });

  it("reports a missing destination status on a move", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.task.move(alice, {
      taskId: SEED_IDS.tasks.dueToday,
      toStatusId: "st-gone",
      toIndex: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("NOT_FOUND");
  });

  it("reports a missing destination list on a move-to-list", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.task.moveToList(alice, SEED_IDS.tasks.dueToday, "li-gone");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("NOT_FOUND");
  });
});

/*
 * Requirement 2.7: a subtask follows its parent between lists, so the depth-1
 * invariant and the same-list constraint both survive the move.
 *
 * `moveTask` covers the drag path already. This covers `moveTaskToList` — the
 * drawer's and the card menu's path — whose subtask loop was reached by no
 * test, which is to say the promise was made in three places and kept in one.
 */
describe("moveTaskToList carries subtasks", () => {
  it("moves the subtasks with their parent and remaps their status", async () => {
    const store = createTestStore();
    const parentId = SEED_IDS.tasks.urgentOverdue;

    const subtaskIds = Object.values(store.getState().tasks)
      .filter((task) => task.parentTaskId === parentId)
      .map((task) => task.id);

    expect(subtaskIds).toHaveLength(2);

    const result = await store
      .getState()
      .actions.task.moveToList(alice, parentId, SEED_IDS.lists.backlog);

    expect(result.ok).toBe(true);

    for (const id of subtaskIds) {
      const subtask = store.getState().tasks[id];

      // Same list as the parent, and a status that belongs to that list.
      expect(subtask?.primaryListId).toBe(SEED_IDS.lists.backlog);
      expect(store.getState().statuses[subtask?.statusId ?? ""]?.listId).toBe(
        SEED_IDS.lists.backlog,
      );
      expect(subtask?.parentTaskId).toBe(parentId);
    }
  });

  /*
   * A subtask keeps its *category* where the destination has one, rather than
   * being dumped into the first status. Sprint 14's "In review" has no Backlog
   * equivalent and is the only category that cannot survive the trip.
   */
  it("preserves each subtask's category where the destination has it", async () => {
    const store = createTestStore();
    const parentId = SEED_IDS.tasks.urgentOverdue;

    const before = Object.values(store.getState().tasks)
      .filter((task) => task.parentTaskId === parentId)
      .map((task) => ({
        id: task.id,
        category: store.getState().statuses[task.statusId]?.category,
      }));

    await store
      .getState()
      .actions.task.moveToList(alice, parentId, SEED_IDS.lists.backlog);

    for (const { id, category } of before) {
      const moved = store.getState().tasks[id];

      expect(store.getState().statuses[moved?.statusId ?? ""]?.category).toBe(
        category,
      );
    }
  });
});

/*
 * The guard Requirement 3.3.1 left in place deliberately. Creation now always
 * gives a list its default statuses, so this is unreachable through the UI —
 * but it is the honest refusal for a list whose statuses went missing some
 * other way, such as a hand-edited `localStorage` payload, and the design doc
 * commits to keeping it. Code kept for a reason should be tested for it.
 */
describe("a list with no statuses", () => {
  it("refuses task creation with CONFLICT rather than filing it nowhere", async () => {
    const store = createTestStore();

    store.setState((state) => ({
      ...state,
      statuses: Object.fromEntries(
        Object.entries(state.statuses).filter(
          ([, status]) => status.listId !== SEED_IDS.lists.backlog,
        ),
      ),
    }));

    const result = await store.getState().actions.task.create(alice, {
      listId: SEED_IDS.lists.backlog,
      title: "Nowhere to go",
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("CONFLICT");
  });
});

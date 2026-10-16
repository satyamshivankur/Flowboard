import { describe, expect, it } from "vitest";

import type { Capability } from "@/config/capabilities";
import { PAGE_SIZE } from "@/config/limits";
import { aContainer, aState, aStatus, aTask, scopeFor } from "@/test/fixtures";

import { createSeedState, SEED_IDS } from "./seed";
import {
  compareTasks,
  flattenTree,
  selectBoardColumns,
  selectBreadcrumb,
  selectEditableLists,
  selectExpansionPath,
  selectFirstVisibleList,
  selectPaginatedRows,
  selectRemappedStatus,
  selectSearchResults,
  selectSubtasks,
  selectTaskRows,
  selectTerminalStatus,
  selectTopLevelTasks,
  selectVisibleLists,
  selectVisibleTree,
} from "./selectors";
import type { SortState, Task } from "./types";

const state = createSeedState();
const alice = scopeFor(SEED_IDS.users.alice);
const bob = scopeFor(SEED_IDS.users.bob);

const asc = (field: SortState["field"]): SortState => ({
  field,
  direction: "asc",
});
const desc = (field: SortState["field"]): SortState => ({
  field,
  direction: "desc",
});

describe("board columns", () => {
  it("orders columns by status position, not insertion order", () => {
    const columns = selectBoardColumns(state, alice, SEED_IDS.lists.sprint14);

    expect(columns.map((column) => column.status.name)).toEqual([
      "To do",
      "In progress",
      "In review",
      "Done",
    ]);
  });

  it("orders tasks within a column by position", () => {
    const columns = selectBoardColumns(state, alice, SEED_IDS.lists.backlog);
    const todo = columns.find((column) => column.status.category === "todo");

    const positions = todo?.tasks.map((task) => task.position) ?? [];

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.length).toBeGreaterThan(1);
  });

  it("excludes subtasks from board columns", () => {
    const columns = selectBoardColumns(state, alice, SEED_IDS.lists.sprint14);
    const ids = columns.flatMap((column) => column.tasks.map((t) => t.id));

    expect(ids).not.toContain("t-009-a");
    expect(ids).not.toContain("t-009-b");
    expect(ids).toContain(SEED_IDS.tasks.urgentOverdue);
  });

  it("reports a count matching its task list", () => {
    for (const column of selectBoardColumns(
      state,
      alice,
      SEED_IDS.lists.backlog,
    )) {
      expect(column.count).toBe(column.tasks.length);
    }
  });
});

describe("sorting", () => {
  const tasks = selectTopLevelTasks(state, alice, SEED_IDS.lists.backlog);

  /*
   * Priority must follow the semantic ranking from PRIORITY_CONFIG, not the
   * alphabetical order of the string values — alphabetically "high" would come
   * before "normal" and "urgent" would come last (Requirement 5.3).
   */
  it("sorts priority by semantic rank, not alphabetically", () => {
    const sorted = [...tasks].sort((a, b) =>
      compareTasks(state, a, b, asc("priority")),
    );

    expect(sorted[0]?.priority).toBe("high");
    expect(sorted.at(-1)?.priority).toBe("none");
  });

  it("reverses priority on descending", () => {
    const sorted = [...tasks].sort((a, b) =>
      compareTasks(state, a, b, desc("priority")),
    );

    expect(sorted[0]?.priority).toBe("none");
  });

  /*
   * Nulls last in BOTH directions. A naive comparator puts them first when
   * descending, which buries every scheduled task below the unscheduled ones
   * (Requirement 5.4).
   */
  it("sorts tasks without a due date last in both directions", () => {
    const withNull: Task[] = [
      aTask({ id: "t-null", dueDate: null }),
      aTask({ id: "t-early", dueDate: "2026-01-01T00:00:00.000Z" }),
      aTask({ id: "t-late", dueDate: "2026-12-01T00:00:00.000Z" }),
    ];

    const ascending = [...withNull].sort((a, b) =>
      compareTasks(state, a, b, asc("dueDate")),
    );
    const descending = [...withNull].sort((a, b) =>
      compareTasks(state, a, b, desc("dueDate")),
    );

    expect(ascending.map((t) => t.id)).toEqual(["t-early", "t-late", "t-null"]);
    expect(descending.map((t) => t.id)).toEqual([
      "t-late",
      "t-early",
      "t-null",
    ]);
  });

  it("sorts by status using column order, not status name", () => {
    const sprintTasks = selectTopLevelTasks(
      state,
      alice,
      SEED_IDS.lists.sprint14,
    );

    const sorted = [...sprintTasks].sort((a, b) =>
      compareTasks(state, a, b, asc("status")),
    );

    const categories = sorted.map(
      (task) => state.statuses[task.statusId]?.category,
    );

    expect(categories[0]).toBe("todo");
    expect(categories.at(-1)).toBe("done");
  });
});

describe("task rows", () => {
  it("nests subtasks under their parent and keeps them off the top level", () => {
    const rows = selectTaskRows(
      state,
      alice,
      SEED_IDS.lists.sprint14,
      asc("dueDate"),
    );

    const parentRow = rows.find(
      (row) => row.task.id === SEED_IDS.tasks.urgentOverdue,
    );

    expect(parentRow?.subtasks.map((task) => task.id)).toEqual([
      "t-009-a",
      "t-009-b",
    ]);
    expect(rows.map((row) => row.task.id)).not.toContain("t-009-a");
  });

  it("returns no rows for a list the user cannot see", () => {
    expect(
      selectTaskRows(state, bob, SEED_IDS.lists.infra, asc("dueDate")),
    ).toEqual([]);
  });
});

describe("pagination", () => {
  const rows = selectTaskRows(
    state,
    alice,
    SEED_IDS.lists.backlog,
    asc("dueDate"),
  );

  it("returns everything when the page size exceeds the row count", () => {
    const page = selectPaginatedRows(rows, 0, PAGE_SIZE);

    expect(page.items).toHaveLength(rows.length);
    expect(page.hasMore).toBe(false);
    expect(page.total).toBe(rows.length);
  });

  /*
   * Pages are cumulative, because the control is "load more" rather than
   * numbered pages — page 1 returns the first two pages' worth.
   */
  it("accumulates rows as the page advances", () => {
    const first = selectPaginatedRows(rows, 0, 2);
    const second = selectPaginatedRows(rows, 1, 2);

    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    expect(second.items).toHaveLength(4);
    expect(second.items.slice(0, 2)).toEqual(first.items);
  });

  it("clears hasMore on the final page", () => {
    const last = selectPaginatedRows(rows, 10, 2);

    expect(last.items).toHaveLength(rows.length);
    expect(last.hasMore).toBe(false);
  });
});

describe("status remapping", () => {
  it("keeps the same category when the destination has one", () => {
    const result = selectRemappedStatus(
      state,
      alice,
      "st-sp-active",
      SEED_IDS.lists.backlog,
    );

    expect(result.remapped).toBe(false);
    expect(result.status?.category).toBe("active");
    expect(result.status?.listId).toBe(SEED_IDS.lists.backlog);
  });

  /*
   * Sprint 14's "In review" is category `active`, so moving it to Backlog finds
   * Backlog's own active status rather than falling back. Constructing a list
   * with a missing category is what actually exercises the fallback.
   */
  it("falls back to the first status and flags the remap", () => {
    const narrow = aState({
      containers: [
        aContainer({ id: "ws-test", type: "workspace", parentId: null }),
        aContainer({ id: "li-from", type: "list", parentId: "ws-test" }),
        aContainer({ id: "li-to", type: "list", parentId: "ws-test" }),
      ],
      statuses: [
        aStatus({
          id: "st-from-done",
          listId: "li-from",
          category: "done",
          position: 1000,
        }),
        aStatus({
          id: "st-to-todo",
          listId: "li-to",
          category: "todo",
          position: 1000,
        }),
      ],
      users: [
        {
          id: "u-a",
          name: "A",
          email: "a@t.test",
          avatarToken: "avatar-indigo",
        },
      ],
      memberships: [{ workspaceId: "ws-test", userId: "u-a", role: "admin" }],
    });

    const result = selectRemappedStatus(
      narrow,
      scopeFor("u-a", "ws-test"),
      "st-from-done",
      "li-to",
    );

    expect(result.remapped).toBe(true);
    expect(result.status?.id).toBe("st-to-todo");
  });

  it("resolves the terminal status for the complete checkbox", () => {
    const terminal = selectTerminalStatus(
      state,
      alice,
      SEED_IDS.lists.sprint14,
    );

    expect(terminal?.category).toBe("done");
    expect(terminal?.name).toBe("Done");
  });
});

describe("breadcrumbs and expansion", () => {
  it("builds the full path from workspace to list", () => {
    const path = selectBreadcrumb(state, alice, SEED_IDS.lists.sprint14);

    expect(path.map((node) => node.id)).toEqual([
      SEED_IDS.workspace,
      SEED_IDS.spaces.engineering,
      SEED_IDS.folders.q2,
      SEED_IDS.lists.sprint14,
    ]);
  });

  it("returns nothing for a node the user cannot see", () => {
    expect(selectBreadcrumb(state, bob, SEED_IDS.lists.infra)).toEqual([]);
  });

  it("excludes the node itself from the expansion path", () => {
    expect(selectExpansionPath(state, alice, SEED_IDS.lists.sprint14)).toEqual([
      SEED_IDS.workspace,
      SEED_IDS.spaces.engineering,
      SEED_IDS.folders.q2,
    ]);
  });
});

describe("flattenTree", () => {
  const tree = selectVisibleTree(state, alice);

  it("shows only top-level nodes when nothing is expanded", () => {
    const rows = flattenTree(tree, new Set());

    expect(rows.map((row) => row.container.id)).toEqual([
      SEED_IDS.spaces.engineering,
      SEED_IDS.spaces.marketing,
    ]);
  });

  it("reveals children of expanded nodes only", () => {
    const rows = flattenTree(tree, new Set([SEED_IDS.spaces.engineering]));

    expect(rows.map((row) => row.container.id)).toEqual([
      SEED_IDS.spaces.engineering,
      SEED_IDS.folders.q2,
      SEED_IDS.folders.platform,
      SEED_IDS.spaces.marketing,
    ]);
  });
});

describe("first visible list", () => {
  it("returns the first list in tree order", () => {
    expect(selectFirstVisibleList(state, alice)?.id).toBe(
      SEED_IDS.lists.backlog,
    );
  });

  it("skips lists the user cannot see", () => {
    const restricted = {
      ...state,
      grants: [
        ...state.grants,
        {
          workspaceId: SEED_IDS.workspace,
          resourceId: SEED_IDS.folders.q2,
          subjectId: SEED_IDS.users.bob,
          subjectType: "user" as const,
          mode: "deny" as const,
        },
      ],
    };

    // Bob now loses Q2's lists and already could not see Infra.
    expect(selectFirstVisibleList(restricted, bob)).toBeUndefined();
  });
});

describe("search", () => {
  it("matches on title and description, case-insensitively", () => {
    expect(
      selectSearchResults(state, alice, "AUTH GUARD").map((hit) => hit.task.id),
    ).toContain(SEED_IDS.tasks.urgentOverdue);

    expect(
      selectSearchResults(state, alice, "redirect").map((hit) => hit.task.id),
    ).toContain(SEED_IDS.tasks.urgentOverdue);
  });

  it("returns nothing for a blank query", () => {
    expect(selectSearchResults(state, alice, "")).toEqual([]);
    expect(selectSearchResults(state, alice, "   ")).toEqual([]);
  });

  it("scopes results to lists the user can see", () => {
    const aliceHits = selectSearchResults(state, alice, "pipeline");
    const bobHits = selectSearchResults(state, bob, "pipeline");

    expect(aliceHits.length).toBeGreaterThan(0);
    expect(bobHits).toHaveLength(0);
  });

  it("attaches the owning list to each hit", () => {
    const hits = selectSearchResults(state, alice, "auth guard");

    expect(hits[0]?.list.id).toBe(SEED_IDS.lists.sprint14);
  });
});

describe("subtasks", () => {
  it("returns a parent's subtasks in position order", () => {
    expect(
      selectSubtasks(state, alice, SEED_IDS.tasks.urgentOverdue).map(
        (task) => task.id,
      ),
    ).toEqual(["t-009-a", "t-009-b"]);
  });

  it("returns nothing for a task the user cannot see", () => {
    const infraTask = Object.values(state.tasks).find(
      (task) => task.primaryListId === SEED_IDS.lists.infra,
    );

    expect(selectSubtasks(state, bob, infraTask?.id ?? "")).toEqual([]);
  });
});

describe("editable lists", () => {
  /*
   * Move-to-list must offer destinations the user can write to, not merely
   * ones they can see. Today those sets coincide for every seeded role, so the
   * distinction is only observable against a capability table that separates
   * them — which is exactly the view-only role the policy table makes possible
   * (Requirement 2.6, 7.9, 21.7).
   */
  const viewOnly = {
    member: new Set<Capability>(["task:reorder"]),
  };

  it("matches the visible lists for a role that can create tasks", () => {
    expect(selectEditableLists(state, bob).map((list) => list.id)).toEqual(
      selectVisibleLists(state, bob).map((list) => list.id),
    );
  });

  it("is empty for a role that can see lists but not write to them", () => {
    expect(selectVisibleLists(state, bob).length).toBeGreaterThan(0);
    expect(selectEditableLists(state, bob, viewOnly)).toEqual([]);
  });

  it("still excludes lists the user cannot see", () => {
    // Bob is denied Infra outright, so no capability table can surface it.
    expect(
      selectEditableLists(state, bob).some(
        (list) => list.id === SEED_IDS.lists.infra,
      ),
    ).toBe(false);
  });
});

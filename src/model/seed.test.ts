import { describe, expect, it } from "vitest";

import { dueDateTone } from "@/lib/date";
import { scopeFor } from "@/test/fixtures";

import { canView, canViewTask } from "./permissions";
import { createSeedState, SEED_IDS, SEED_NOW, WORKSPACE_ID } from "./seed";
import {
  selectBoardColumns,
  selectStatusesForList,
  selectVisibleLists,
  selectVisibleTree,
  type TreeNode,
} from "./selectors";
import { findTask } from "./state";

/**
 * Seed-shape and visible-tree assertions.
 *
 * The "Alice vs Bob demo in under 30 seconds" the brief asks for is a property
 * of the seed data, not of the UI. Asserting the exact visible node set per
 * user means the demo is guaranteed by CI rather than by remembering to check
 * it before recording (Requirement 8.14, 18.3).
 */

const state = createSeedState();

const alice = scopeFor(SEED_IDS.users.alice);
const bob = scopeFor(SEED_IDS.users.bob);
const carol = scopeFor(SEED_IDS.users.carol);

/** Flattens a tree to its container ids, depth-first. */
function idsOf(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => [node.container.id, ...idsOf(node.children)]);
}

describe("seed shape", () => {
  it("matches the counts the brief requires", () => {
    const containers = Object.values(state.containers);

    expect(containers.filter((c) => c.type === "workspace")).toHaveLength(1);
    expect(containers.filter((c) => c.type === "space")).toHaveLength(2);
    expect(containers.filter((c) => c.type === "folder")).toHaveLength(2);
    expect(containers.filter((c) => c.type === "list")).toHaveLength(3);
    expect(Object.keys(state.users)).toHaveLength(3);
    expect(state.grants.length).toBeGreaterThan(0);

    // 17 top-level tasks plus 2 subtasks, against a requirement of 15+.
    expect(Object.keys(state.tasks).length).toBeGreaterThanOrEqual(15);
    expect(Object.keys(state.tasks)).toHaveLength(19);
  });

  it("gives every entity a workspaceId", () => {
    for (const container of Object.values(state.containers)) {
      expect(container.workspaceId).toBe(WORKSPACE_ID);
    }
    for (const task of Object.values(state.tasks)) {
      expect(task.workspaceId).toBe(WORKSPACE_ID);
    }
    for (const status of Object.values(state.statuses)) {
      expect(status.workspaceId).toBe(WORKSPACE_ID);
    }
  });

  it("keeps role on membership and off the user", () => {
    expect(state.memberships).toHaveLength(3);
    expect(
      state.memberships.find((m) => m.userId === SEED_IDS.users.alice)?.role,
    ).toBe("admin");
    expect(
      state.memberships.find((m) => m.userId === SEED_IDS.users.bob)?.role,
    ).toBe("member");

    for (const user of Object.values(state.users)) {
      expect(user).not.toHaveProperty("role");
    }
  });

  it("gives every list a status in each category", () => {
    for (const listId of Object.values(SEED_IDS.lists)) {
      const categories = selectStatusesForList(state, alice, listId).map(
        (status) => status.category,
      );

      expect(categories).toContain("todo");
      expect(categories).toContain("active");
      expect(categories).toContain("done");
    }
  });

  it("gives one list a distinct extra status, so sets are visibly per-list", () => {
    const backlog = selectStatusesForList(state, alice, SEED_IDS.lists.backlog);
    const sprint = selectStatusesForList(state, alice, SEED_IDS.lists.sprint14);

    expect(backlog).toHaveLength(3);
    expect(sprint).toHaveLength(4);
    expect(sprint.map((s) => s.name)).toContain("In review");
  });

  it("only ever assigns a task a status from its own list", () => {
    for (const task of Object.values(state.tasks)) {
      const status = state.statuses[task.statusId];

      expect(status).toBeDefined();
      expect(status?.listId).toBe(task.primaryListId);
    }
  });

  it("keeps subtasks at depth 1 and in their parent's list", () => {
    const subtasks = Object.values(state.tasks).filter(
      (task) => task.parentTaskId !== null,
    );

    expect(subtasks).toHaveLength(2);

    for (const subtask of subtasks) {
      const parent = findTask(state, subtask.parentTaskId ?? "");

      expect(parent).toBeDefined();
      expect(parent?.parentTaskId).toBeNull();
      expect(parent?.primaryListId).toBe(subtask.primaryListId);
    }
  });

  it("covers the due-date states the UI has to render", () => {
    const tones = Object.values(state.tasks).map((task) =>
      dueDateTone(task.dueDate, SEED_NOW),
    );

    expect(tones).toContain("overdue");
    expect(tones).toContain("today");
    expect(tones).toContain("upcoming");
    expect(tones).toContain("none");
  });

  it("covers the assignee and priority states the UI has to render", () => {
    const tasks = Object.values(state.tasks);

    expect(tasks.some((task) => task.assigneeIds.length === 0)).toBe(true);
    expect(tasks.some((task) => task.assigneeIds.length > 1)).toBe(true);
    expect(tasks.some((task) => task.priority === "urgent")).toBe(true);
    expect(tasks.some((task) => task.priority === "none")).toBe(true);
  });
});

describe("visible tree per user", () => {
  /*
   * These are the exact node sets. If a grant or a visibility flag changes, one
   * of these fails rather than the demo quietly degrading.
   */

  it("shows Alice everything, as admin", () => {
    expect(idsOf(selectVisibleTree(state, alice))).toEqual([
      SEED_IDS.spaces.engineering,
      SEED_IDS.folders.q2,
      SEED_IDS.lists.backlog,
      SEED_IDS.lists.sprint14,
      SEED_IDS.folders.platform,
      SEED_IDS.lists.infra,
      SEED_IDS.spaces.marketing,
    ]);
  });

  it("hides Marketing and Infra from Bob", () => {
    expect(idsOf(selectVisibleTree(state, bob))).toEqual([
      SEED_IDS.spaces.engineering,
      SEED_IDS.folders.q2,
      SEED_IDS.lists.backlog,
      SEED_IDS.lists.sprint14,
      SEED_IDS.folders.platform,
    ]);
  });

  it("shows Carol everything Bob sees, plus Infra and Marketing", () => {
    expect(idsOf(selectVisibleTree(state, carol))).toEqual([
      SEED_IDS.spaces.engineering,
      SEED_IDS.folders.q2,
      SEED_IDS.lists.backlog,
      SEED_IDS.lists.sprint14,
      SEED_IDS.folders.platform,
      SEED_IDS.lists.infra,
      SEED_IDS.spaces.marketing,
    ]);
  });

  /*
   * Bob keeps Platform but loses its only list, which is precisely the case
   * Requirement 6.8's "no visible lists" hint exists for. Without this flag the
   * sidebar would render Platform as an expandable dead end.
   */
  it("marks Platform as having hidden children for Bob only", () => {
    const platformFor = (scope: typeof bob) =>
      selectVisibleTree(state, scope)
        .flatMap((node) => node.children)
        .find((node) => node.container.id === SEED_IDS.folders.platform);

    expect(platformFor(bob)?.hasHiddenChildren).toBe(true);
    expect(platformFor(bob)?.children).toHaveLength(0);
    expect(platformFor(carol)?.hasHiddenChildren).toBe(false);
    expect(platformFor(alice)?.hasHiddenChildren).toBe(false);
  });

  it("differs between Alice and Bob, which is the demo", () => {
    const aliceLists = selectVisibleLists(state, alice).map((l) => l.id);
    const bobLists = selectVisibleLists(state, bob).map((l) => l.id);

    expect(aliceLists).toHaveLength(3);
    expect(bobLists).toHaveLength(2);
    expect(bobLists).not.toContain(SEED_IDS.lists.infra);
  });
});

describe("task visibility follows list visibility", () => {
  it("denies Bob every task in the Infra list", () => {
    const infraTasks = Object.values(state.tasks).filter(
      (task) => task.primaryListId === SEED_IDS.lists.infra,
    );

    expect(infraTasks.length).toBeGreaterThan(0);

    for (const task of infraTasks) {
      expect(canViewTask(state, bob, task.id)).toBe(false);
      expect(canViewTask(state, carol, task.id)).toBe(true);
      expect(canViewTask(state, alice, task.id)).toBe(true);
    }
  });

  it("returns an empty board for a list Bob cannot see", () => {
    expect(selectBoardColumns(state, bob, SEED_IDS.lists.infra)).toEqual([]);
    expect(selectStatusesForList(state, bob, SEED_IDS.lists.infra)).toEqual([]);
  });

  it("returns a populated board for a list Bob can see", () => {
    const columns = selectBoardColumns(state, bob, SEED_IDS.lists.sprint14);

    expect(columns).toHaveLength(4);
    expect(columns.reduce((sum, column) => sum + column.count, 0)).toBe(6);
  });

  it("keeps the private Marketing space out of Bob's reach", () => {
    expect(canView(state, bob, SEED_IDS.spaces.marketing)).toBe(false);
    expect(canView(state, carol, SEED_IDS.spaces.marketing)).toBe(true);
    expect(canView(state, alice, SEED_IDS.spaces.marketing)).toBe(true);
  });
});

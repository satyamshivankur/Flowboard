import { describe, expect, it } from "vitest";

import {
  aTwoWorkspaceState,
  OTHER_WORKSPACE_ID,
  scopeFor,
} from "@/test/fixtures";

import { can, canView, canViewTask, roleOf } from "./permissions";
import { SEED_IDS, WORKSPACE_ID } from "./seed";
import {
  selectAssignees,
  selectBoardColumns,
  selectSearchResults,
  selectTasksForList,
  selectVisibleLists,
  selectVisibleTree,
  selectWorkspaceMembers,
} from "./selectors";
import { containersInWorkspace, tasksInWorkspace } from "./state";

/**
 * Workspace scoping.
 *
 * The delivered scope is one workspace, which means a selector that forgets to
 * filter on `workspaceId` passes every other test in this suite. This fixture
 * adds a second workspace that must never appear in an Acme-scoped result, so
 * the single-workspace assumption cannot creep back in unnoticed
 * (Requirement 18.10, 21.1, 21.2).
 *
 * Alice is an admin of Acme and only a *member* of the other workspace, which
 * is what catches a bypass check that reads role globally rather than per
 * workspace.
 */

const state = aTwoWorkspaceState();

const aliceInAcme = scopeFor(SEED_IDS.users.alice, WORKSPACE_ID);
const aliceInOther = scopeFor(SEED_IDS.users.alice, OTHER_WORKSPACE_ID);
const bobInAcme = scopeFor(SEED_IDS.users.bob, WORKSPACE_ID);
const bobInOther = scopeFor(SEED_IDS.users.bob, OTHER_WORKSPACE_ID);

const OTHER_CONTAINER_IDS = [OTHER_WORKSPACE_ID, "sp-other", "li-other"];
const OTHER_TASK_IDS = ["t-other-1", "t-other-2"];

describe("role resolves per workspace", () => {
  it("gives Alice admin in Acme and member in the other workspace", () => {
    expect(roleOf(state, WORKSPACE_ID, SEED_IDS.users.alice)).toBe("admin");
    expect(roleOf(state, OTHER_WORKSPACE_ID, SEED_IDS.users.alice)).toBe(
      "member",
    );
  });

  it("gives Bob no role at all in the other workspace", () => {
    expect(roleOf(state, OTHER_WORKSPACE_ID, SEED_IDS.users.bob)).toBeNull();
  });

  /*
   * The check a global `user.role` field would fail. Alice's admin bypass must
   * not follow her into a workspace where she is only a member.
   */
  it("does not carry Alice's Acme admin bypass into the other workspace", () => {
    expect(can(state, aliceInAcme, "container:archive", SEED_IDS.lists.backlog)).toBe(
      true,
    );
    expect(can(state, aliceInOther, "container:archive", "li-other")).toBe(
      false,
    );
    // She is still a member there, so tasks remain editable.
    expect(can(state, aliceInOther, "task:update", "li-other")).toBe(true);
  });
});

describe("canView rejects cross-workspace nodes", () => {
  it("hides other-workspace containers from an Acme scope, even for an admin", () => {
    for (const id of OTHER_CONTAINER_IDS) {
      expect(canView(state, aliceInAcme, id)).toBe(false);
      expect(canView(state, bobInAcme, id)).toBe(false);
    }
  });

  it("hides Acme containers from an other-workspace scope", () => {
    for (const id of [
      WORKSPACE_ID,
      SEED_IDS.spaces.engineering,
      SEED_IDS.lists.backlog,
    ]) {
      expect(canView(state, aliceInOther, id)).toBe(false);
    }
  });

  it("denies everything to a user with no membership in the scope", () => {
    for (const id of OTHER_CONTAINER_IDS) {
      expect(canView(state, bobInOther, id)).toBe(false);
    }
  });

  it("hides other-workspace tasks from an Acme scope", () => {
    for (const id of OTHER_TASK_IDS) {
      expect(canViewTask(state, aliceInAcme, id)).toBe(false);
      expect(canViewTask(state, bobInAcme, id)).toBe(false);
    }
  });
});

describe("selectors never leak across workspaces", () => {
  it("keeps the other workspace out of the visible tree", () => {
    const collect = (
      nodes: ReturnType<typeof selectVisibleTree>,
    ): string[] =>
      nodes.flatMap((node) => [node.container.id, ...collect(node.children)]);

    const acmeIds = collect(selectVisibleTree(state, aliceInAcme));

    for (const id of OTHER_CONTAINER_IDS) {
      expect(acmeIds).not.toContain(id);
    }
  });

  it("keeps the other workspace's lists out of selectVisibleLists", () => {
    const listIds = selectVisibleLists(state, aliceInAcme).map(
      (list) => list.id,
    );

    expect(listIds).toEqual([
      SEED_IDS.lists.backlog,
      SEED_IDS.lists.sprint14,
      SEED_IDS.lists.infra,
    ]);
    expect(listIds).not.toContain("li-other");
  });

  it("returns nothing for a cross-workspace list id", () => {
    expect(selectTasksForList(state, aliceInAcme, "li-other")).toEqual([]);
    expect(selectBoardColumns(state, aliceInAcme, "li-other")).toEqual([]);
  });

  /*
   * Search is the easiest selector to get wrong, because it iterates all tasks
   * rather than starting from a list. The other-workspace task's title and
   * description both contain terms an Acme search would otherwise match.
   */
  it("keeps the other workspace out of search results", () => {
    const hits = selectSearchResults(state, aliceInAcme, "appear");

    expect(hits).toHaveLength(0);

    const descriptionHits = selectSearchResults(state, aliceInAcme, "description");

    expect(
      descriptionHits.map((hit) => hit.task.id),
    ).not.toContain("t-other-1");
  });

  it("finds Acme tasks in an Acme search", () => {
    const hits = selectSearchResults(state, aliceInAcme, "auth guard");

    expect(hits.map((hit) => hit.task.id)).toContain(SEED_IDS.tasks.urgentOverdue);
  });

  it("scopes workspace members to the workspace", () => {
    const acmeMembers = selectWorkspaceMembers(state, aliceInAcme).map(
      (user) => user.id,
    );
    const otherMembers = selectWorkspaceMembers(state, aliceInOther).map(
      (user) => user.id,
    );

    expect(acmeMembers).toHaveLength(3);
    expect(otherMembers).toEqual([SEED_IDS.users.alice]);
  });

  it("scopes the low-level state helpers too", () => {
    const acmeContainers = containersInWorkspace(state, WORKSPACE_ID).map(
      (c) => c.id,
    );
    const otherContainers = containersInWorkspace(
      state,
      OTHER_WORKSPACE_ID,
    ).map((c) => c.id);

    for (const id of OTHER_CONTAINER_IDS) {
      expect(acmeContainers).not.toContain(id);
      expect(otherContainers).toContain(id);
    }

    expect(tasksInWorkspace(state, WORKSPACE_ID)).toHaveLength(19);
    expect(tasksInWorkspace(state, OTHER_WORKSPACE_ID)).toHaveLength(2);
  });
});

describe("assignee resolution", () => {
  /*
   * selectAssignees is intentionally NOT workspace-scoped: it resolves ids that
   * a task already holds, and a task's assignees were validated at write time.
   * Filtering here would silently drop avatars instead of surfacing bad data.
   */
  it("resolves ids a task already holds, dropping only unknown users", () => {
    const resolved = selectAssignees(state, [
      SEED_IDS.users.alice,
      "u-does-not-exist",
    ]);

    expect(resolved.map((user) => user.id)).toEqual([SEED_IDS.users.alice]);
  });
});

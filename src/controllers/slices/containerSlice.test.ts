import { describe, expect, it } from "vitest";

import { canView } from "@/model/permissions";
import { SEED_IDS } from "@/model/seed";
import {
  selectBoardColumns,
  selectContainerAccess,
  selectStatusesForList,
  selectVisibleTree,
  type TreeNode,
} from "@/model/selectors";
import type { Grant } from "@/model/types";
import { scopeFor } from "@/test/fixtures";
import { createTestStore, domainSnapshot } from "@/test/store";

const alice = scopeFor(SEED_IDS.users.alice);
const bob = scopeFor(SEED_IDS.users.bob);
const carol = scopeFor(SEED_IDS.users.carol);

function idsOf(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => [node.container.id, ...idsOf(node.children)]);
}

/** The grant rows attached to one container, for asserting what was written. */
function grantsOn(
  store: ReturnType<typeof createTestStore>,
  resourceId: string,
): readonly Grant[] {
  return store
    .getState()
    .grants.filter((grant) => grant.resourceId === resourceId);
}

describe("createContainer", () => {
  it("creates a list inside a folder and appends it", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.container.create(alice, {
      parentId: SEED_IDS.folders.q2,
      type: "list",
      name: "  Sprint 15  ",
    });

    expect(result.ok).toBe(true);

    const created = result.ok ? result.data : null;

    expect(created?.name).toBe("Sprint 15");
    expect(created?.type).toBe("list");
    expect(created?.parentId).toBe(SEED_IDS.folders.q2);
    expect(created?.archivedAt).toBeNull();
    expect(created?.workspaceId).toBe(SEED_IDS.workspace);

    const q2 = selectVisibleTree(store.getState(), alice)
      .flatMap((node) => node.children)
      .find((node) => node.container.id === SEED_IDS.folders.q2);

    expect(q2?.children.at(-1)?.container.id).toBe(created?.id);
  });

  /*
   * The bug this covers: `create` wrote only the container, so a new list had
   * no statuses — the board fell through to "This list has no statuses" and
   * `taskSlice.create` refused with CONFLICT, leaving no route out of it.
   */
  it("gives a new list the default status set, in category order", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.container.create(alice, {
      parentId: SEED_IDS.folders.q2,
      type: "list",
      name: "Sprint 15",
    });

    const listId = result.ok ? result.data.id : "";
    const statuses = selectStatusesForList(store.getState(), alice, listId);

    expect(statuses.map((status) => status.name)).toEqual([
      "To do",
      "In progress",
      "Done",
    ]);
    expect(statuses.map((status) => status.category)).toEqual([
      "todo",
      "active",
      "done",
    ]);

    for (const status of statuses) {
      expect(status.listId).toBe(listId);
      expect(status.workspaceId).toBe(SEED_IDS.workspace);
    }

    // The board has columns, and a task can actually be filed in one.
    const columns = selectBoardColumns(store.getState(), alice, listId);

    expect(columns).toHaveLength(3);
    expect(columns.every((column) => column.tasks.length === 0)).toBe(true);

    const task = await store.getState().actions.task.create(alice, {
      listId,
      statusId: statuses[0]?.id ?? "",
      title: "First task",
    });

    expect(task.ok).toBe(true);
  });

  /* Gated on the registry's `holdsTasks`, so only a list gets a status set. */
  it("creates no statuses for a container that does not hold tasks", async () => {
    const store = createTestStore();
    const before = Object.keys(store.getState().statuses).length;

    await store.getState().actions.container.create(alice, {
      parentId: SEED_IDS.spaces.engineering,
      type: "folder",
      name: "Q3 Launch",
    });

    expect(Object.keys(store.getState().statuses)).toHaveLength(before);
  });

  /*
   * A rejected create must leave nothing behind — including the statuses,
   * which is the reason they are written in the same `apply` as the container
   * rather than as a follow-up mutation.
   */
  it("writes neither the list nor its statuses when creation is refused", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store.getState().actions.container.create(bob, {
      parentId: SEED_IDS.folders.q2,
      type: "list",
      name: "Sprint 15",
    });

    expect(result.ok).toBe(false);
    expect(domainSnapshot(store)).toEqual(before);
  });

  /*
   * The behaviour change of Requirement 8.15. Creation used to default to
   * `public`, handing every member access to a container nobody had decided to
   * share. It now fails closed: admins only, until someone says otherwise.
   */
  it("restricts a new container to admins when no access is given", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.container.create(alice, {
      parentId: SEED_IDS.workspace,
      type: "space",
      name: "Finance",
    });

    const createdId = result.ok ? result.data.id : "";

    expect(result.ok ? result.data.visibility : null).toBe("private");
    expect(canView(store.getState(), alice, createdId)).toBe(true);
    expect(canView(store.getState(), bob, createdId)).toBe(false);
    expect(canView(store.getState(), carol, createdId)).toBe(false);

    // No grant rows either — restricted means "nothing written", not
    // "everything denied".
    expect(grantsOn(store, createdId)).toEqual([]);
  });

  it("gives access to exactly the members chosen at creation", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.container.create(alice, {
      parentId: SEED_IDS.workspace,
      type: "space",
      name: "Finance",
      access: { visibility: "private", memberIds: [SEED_IDS.users.carol] },
    });

    const createdId = result.ok ? result.data.id : "";

    expect(canView(store.getState(), carol, createdId)).toBe(true);
    expect(canView(store.getState(), bob, createdId)).toBe(false);

    expect(grantsOn(store, createdId)).toEqual([
      {
        workspaceId: SEED_IDS.workspace,
        resourceId: createdId,
        subjectId: SEED_IDS.users.carol,
        subjectType: "user",
        mode: "allow",
      },
    ]);
  });

  /*
   * "Everyone" is still expressible — it is no longer the default. Excluding a
   * member writes the deny row, which is the same mechanism the seed uses for
   * Bob on Infra.
   */
  it("opens a container to everyone except the members left out", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.container.create(alice, {
      parentId: SEED_IDS.workspace,
      type: "space",
      name: "Finance",
      access: { visibility: "public", memberIds: [SEED_IDS.users.bob] },
    });

    const createdId = result.ok ? result.data.id : "";

    expect(result.ok ? result.data.visibility : null).toBe("public");
    expect(canView(store.getState(), bob, createdId)).toBe(true);
    expect(canView(store.getState(), carol, createdId)).toBe(false);
    expect(grantsOn(store, createdId).map((grant) => grant.mode)).toEqual([
      "deny",
    ]);
  });

  it("refuses an access list naming someone outside the workspace", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store.getState().actions.container.create(alice, {
      parentId: SEED_IDS.workspace,
      type: "space",
      name: "Finance",
      access: { visibility: "private", memberIds: ["u-stranger"] },
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
    expect(domainSnapshot(store)).toEqual(before);
  });

  /*
   * The grants belong to the same `apply` as the container and its statuses,
   * for the same reason: a follow-up write would pass every other assertion
   * here and fail only this one.
   */
  it("writes no grants when creation is refused", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store.getState().actions.container.create(bob, {
      parentId: SEED_IDS.folders.q2,
      type: "list",
      name: "Sprint 15",
      access: { visibility: "private", memberIds: [SEED_IDS.users.carol] },
    });

    expect(result.ok).toBe(false);
    expect(domainSnapshot(store)).toEqual(before);
  });
});

describe("setContainerAccess", () => {
  it("grants a member access to an existing public container", async () => {
    const store = createTestStore();

    // Bob is denied Infra in the seed; re-including him lifts it.
    const result = await store
      .getState()
      .actions.container.setAccess(alice, SEED_IDS.lists.infra, {
        visibility: "public",
        memberIds: [SEED_IDS.users.bob, SEED_IDS.users.carol],
      });

    expect(result.ok).toBe(true);
    expect(canView(store.getState(), bob, SEED_IDS.lists.infra)).toBe(true);
    expect(grantsOn(store, SEED_IDS.lists.infra)).toEqual([]);
  });

  it("revokes access from a member of an existing container", async () => {
    const store = createTestStore();

    await store
      .getState()
      .actions.container.setAccess(alice, SEED_IDS.lists.backlog, {
        visibility: "private",
        memberIds: [SEED_IDS.users.carol],
      });

    expect(canView(store.getState(), carol, SEED_IDS.lists.backlog)).toBe(true);
    expect(canView(store.getState(), bob, SEED_IDS.lists.backlog)).toBe(false);

    // Bob keeps the rest of the tree — a save touches one resource's rows.
    expect(canView(store.getState(), bob, SEED_IDS.lists.sprint14)).toBe(true);
  });

  it("reads back the access it just wrote", async () => {
    const store = createTestStore();
    const access = {
      visibility: "private" as const,
      memberIds: [SEED_IDS.users.bob],
    };

    await store
      .getState()
      .actions.container.setAccess(alice, SEED_IDS.spaces.marketing, access);

    expect(
      selectContainerAccess(store.getState(), alice, SEED_IDS.spaces.marketing),
    ).toEqual(access);
  });

  it("refuses a member and leaves every grant untouched", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store
      .getState()
      .actions.container.setAccess(bob, SEED_IDS.lists.backlog, {
        visibility: "private",
        memberIds: [SEED_IDS.users.bob],
      });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("refuses the workspace itself, which carries no access list", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.setAccess(alice, SEED_IDS.workspace, {
        visibility: "private",
        memberIds: [],
      });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
  });
});

describe("renameContainer", () => {
  it("renames and bumps updatedAt", async () => {
    const store = createTestStore();
    const before = store.getState().containers[SEED_IDS.lists.backlog];

    const result = await store
      .getState()
      .actions.container.rename(alice, SEED_IDS.lists.backlog, "Icebox");

    expect(result.ok).toBe(true);
    expect(store.getState().containers[SEED_IDS.lists.backlog]?.name).toBe(
      "Icebox",
    );
    expect(
      store.getState().containers[SEED_IDS.lists.backlog]?.updatedAt,
    ).not.toBe(before?.updatedAt);
  });

  /*
   * The workspace node is marked immutable in the registry, so this is a
   * configuration-driven refusal rather than a hard-coded special case.
   */
  it("refuses to rename the workspace", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.rename(alice, SEED_IDS.workspace, "Renamed Co");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
  });

  it("rejects a blank name and changes nothing", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store
      .getState()
      .actions.container.rename(alice, SEED_IDS.lists.backlog, "   ");

    expect(result.ok).toBe(false);
    expect(domainSnapshot(store)).toEqual(before);
  });
});

describe("archiveContainer", () => {
  it("archives a list and removes it from the tree", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.archive(alice, SEED_IDS.lists.backlog);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.archivedIds : []).toEqual([
      SEED_IDS.lists.backlog,
    ]);

    expect(
      store.getState().containers[SEED_IDS.lists.backlog]?.archivedAt,
    ).not.toBeNull();
    expect(idsOf(selectVisibleTree(store.getState(), alice))).not.toContain(
      SEED_IDS.lists.backlog,
    );
  });

  it("cascades down the subtree", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.archive(alice, SEED_IDS.spaces.engineering);

    expect(result.ok).toBe(true);

    const archived = result.ok ? [...result.data.archivedIds].sort() : [];

    expect(archived).toEqual(
      [
        SEED_IDS.spaces.engineering,
        SEED_IDS.folders.q2,
        SEED_IDS.folders.platform,
        SEED_IDS.lists.backlog,
        SEED_IDS.lists.sprint14,
        SEED_IDS.lists.infra,
      ].sort(),
    );
  });

  /*
   * Archiving is soft: the tasks of an archived list are unreachable because
   * every task selector resolves through its list, but nothing is deleted — so
   * the choice is genuinely reversible (Requirement 1.5, 1.6).
   */
  it("keeps the tasks of an archived list in the Model", async () => {
    const store = createTestStore();
    const taskCountBefore = Object.keys(store.getState().tasks).length;

    await store
      .getState()
      .actions.container.archive(alice, SEED_IDS.lists.backlog);

    expect(Object.keys(store.getState().tasks)).toHaveLength(taskCountBefore);
  });

  it("refuses to archive the workspace", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.archive(alice, SEED_IDS.workspace);

    expect(result.ok).toBe(false);
  });

  it("refuses to archive something already archived", async () => {
    const store = createTestStore();

    await store
      .getState()
      .actions.container.archive(alice, SEED_IDS.lists.backlog);

    const second = await store
      .getState()
      .actions.container.archive(alice, SEED_IDS.lists.backlog);

    expect(second.ok).toBe(false);
    expect(second.ok ? null : second.error.code).toBe("CONFLICT");
  });

  it("is admin-only", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.archive(bob, SEED_IDS.lists.backlog);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
  });
});

describe("unarchiveContainer", () => {
  it("restores an archived subtree", async () => {
    const store = createTestStore();

    await store
      .getState()
      .actions.container.archive(alice, SEED_IDS.folders.q2);

    const result = await store
      .getState()
      .actions.container.unarchive(alice, SEED_IDS.folders.q2);

    expect(result.ok).toBe(true);

    const restored = result.ok ? [...result.data.restoredIds].sort() : [];

    expect(restored).toEqual(
      [
        SEED_IDS.folders.q2,
        SEED_IDS.lists.backlog,
        SEED_IDS.lists.sprint14,
      ].sort(),
    );

    expect(idsOf(selectVisibleTree(store.getState(), alice))).toContain(
      SEED_IDS.lists.backlog,
    );
  });

  /*
   * Restoring a child under a still-archived parent would produce a live node
   * nobody can reach, since visibility walks the whole chain.
   */
  it("refuses to restore a child while its parent is archived", async () => {
    const store = createTestStore();

    await store
      .getState()
      .actions.container.archive(alice, SEED_IDS.folders.q2);

    const result = await store
      .getState()
      .actions.container.unarchive(alice, SEED_IDS.lists.backlog);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("CONFLICT");
    expect(result.ok ? null : result.error.message).toMatch(/Q2 Launch/);
  });

  it("refuses to restore something that is not archived", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.unarchive(alice, SEED_IDS.lists.backlog);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("CONFLICT");
  });
});

describe("reorderContainer", () => {
  it("moves a sibling to the front", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.reorder(alice, SEED_IDS.lists.sprint14, 0);

    expect(result.ok).toBe(true);

    const q2 = selectVisibleTree(store.getState(), alice)
      .flatMap((node) => node.children)
      .find((node) => node.container.id === SEED_IDS.folders.q2);

    expect(q2?.children.map((child) => child.container.id)).toEqual([
      SEED_IDS.lists.sprint14,
      SEED_IDS.lists.backlog,
    ]);
  });

  it("is admin-only", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.reorder(bob, SEED_IDS.lists.sprint14, 0);

    expect(result.ok).toBe(false);
  });
});

describe("moveContainer", () => {
  it("reparents a list into another folder", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.move(
        alice,
        SEED_IDS.lists.backlog,
        SEED_IDS.folders.platform,
        0,
      );

    expect(result.ok).toBe(true);
    expect(store.getState().containers[SEED_IDS.lists.backlog]?.parentId).toBe(
      SEED_IDS.folders.platform,
    );

    const platform = selectVisibleTree(store.getState(), alice)
      .flatMap((node) => node.children)
      .find((node) => node.container.id === SEED_IDS.folders.platform);

    expect(platform?.children.map((child) => child.container.id)).toEqual([
      SEED_IDS.lists.backlog,
      SEED_IDS.lists.infra,
    ]);
  });

  it("rejects an invalid type pairing and changes nothing", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store
      .getState()
      .actions.container.move(
        alice,
        SEED_IDS.lists.backlog,
        SEED_IDS.lists.sprint14,
        0,
      );

    expect(result.ok).toBe(false);
    expect(domainSnapshot(store)).toEqual(before);
  });

  it("rejects moving a node into its own descendant", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.container.move(
        alice,
        SEED_IDS.folders.q2,
        SEED_IDS.lists.backlog,
        0,
      );

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
  });
});

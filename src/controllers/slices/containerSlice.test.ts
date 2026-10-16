import { describe, expect, it } from "vitest";

import { canView } from "@/model/permissions";
import { SEED_IDS } from "@/model/seed";
import { selectVisibleTree, type TreeNode } from "@/model/selectors";
import { scopeFor } from "@/test/fixtures";
import { createTestStore, domainSnapshot } from "@/test/store";

const alice = scopeFor(SEED_IDS.users.alice);
const bob = scopeFor(SEED_IDS.users.bob);

function idsOf(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => [node.container.id, ...idsOf(node.children)]);
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
    expect(created?.visibility).toBe("public");
    expect(created?.archivedAt).toBeNull();
    expect(created?.workspaceId).toBe(SEED_IDS.workspace);

    const q2 = selectVisibleTree(store.getState(), alice)
      .flatMap((node) => node.children)
      .find((node) => node.container.id === SEED_IDS.folders.q2);

    expect(q2?.children.at(-1)?.container.id).toBe(created?.id);
  });

  it("accepts a private visibility at creation", async () => {
    const store = createTestStore();

    const result = await store.getState().actions.container.create(alice, {
      parentId: SEED_IDS.workspace,
      type: "space",
      name: "Finance",
      visibility: "private",
    });

    expect(result.ok ? result.data.visibility : null).toBe("private");

    // Private with no grant means even another admin-less member cannot see it.
    expect(
      canView(store.getState(), bob, result.ok ? result.data.id : ""),
    ).toBe(false);
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

import { describe, expect, it } from "vitest";

import { unwrap } from "@/model/result";
import { SEED_IDS } from "@/model/seed";
import { selectStatusesForList } from "@/model/selectors";
import { scopeFor } from "@/test/fixtures";
import { createTestStore, domainSnapshot } from "@/test/store";

/**
 * The per-list status actions.
 *
 * These existed from Phase 2 and were covered by nothing — 7% of statements,
 * 0% of branches — while the slice's own doc comment claimed "the actions
 * exist and are tested". The design doc had already caught a version of that
 * claim once and corrected the prose; this file corrects the fact instead.
 *
 * There is no status editor in the UI, so these are the only thing that
 * exercises `status:update` at all. That matters more than it sounds: the
 * capability is admin-only and nothing else in the app reads it, so without
 * these tests a change to the capability table could silently open or close
 * status editing and no test in the suite would notice.
 */

const alice = scopeFor(SEED_IDS.users.alice);
const bob = scopeFor(SEED_IDS.users.bob);

/** The seed's Backlog statuses: `st-bk-todo`, `st-bk-active`, `st-bk-done`. */
const BACKLOG_TODO = "st-bk-todo";
const BACKLOG_DONE = "st-bk-done";

function backlogStatuses(store: ReturnType<typeof createTestStore>) {
  return selectStatusesForList(
    store.getState(),
    alice,
    SEED_IDS.lists.backlog,
  );
}

describe("renameStatus", () => {
  it("renames and trims, leaving every other field alone", async () => {
    const store = createTestStore();
    const before = store.getState().statuses[BACKLOG_TODO];

    const renamed = unwrap(
      await store
        .getState()
        .actions.status.rename(alice, BACKLOG_TODO, "  Up next  "),
    );

    expect(renamed.name).toBe("Up next");
    expect(renamed.category).toBe(before?.category);
    expect(renamed.position).toBe(before?.position);
    expect(renamed.listId).toBe(SEED_IDS.lists.backlog);

    expect(backlogStatuses(store).map((status) => status.name)).toEqual([
      "Up next",
      "In progress",
      "Done",
    ]);
  });

  /*
   * Statuses are owned per list (Requirement 3.1), so renaming Backlog's "To
   * do" must not touch the identically-named status on Sprint 14. The two
   * share a name and a category and nothing else.
   */
  it("leaves the same-named status on another list untouched", async () => {
    const store = createTestStore();

    await store
      .getState()
      .actions.status.rename(alice, BACKLOG_TODO, "Up next");

    expect(store.getState().statuses["st-sp-todo"]?.name).toBe("To do");
  });

  it("reuses the container-name rules for the field", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.status.rename(alice, BACKLOG_TODO, "   ");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("VALIDATION");
    expect(result.ok ? null : result.error.field).toBe("name");
  });

  it("reports an unknown status as NOT_FOUND", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.status.rename(alice, "st-gone", "Anything");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("NOT_FOUND");
  });

  /*
   * `status:update` is admin-only in the capability table, and this is the only
   * place in the suite that proves it end to end rather than by reading the
   * table (Requirement 8.9).
   */
  it("refuses a member and leaves the status untouched", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store
      .getState()
      .actions.status.rename(bob, BACKLOG_TODO, "Up next");

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(domainSnapshot(store)).toEqual(before);
  });

  /*
   * Bob is denied the Infra list by an explicit grant, so its statuses are not
   * his to rename either — and the message has to say "no access" rather than
   * "wrong role", because the two are different problems (Requirement 8.11).
   */
  it("distinguishes a denied list from an insufficient role", async () => {
    const store = createTestStore();

    const denied = await store
      .getState()
      .actions.status.rename(bob, "st-in-todo", "Up next");

    expect(denied.ok ? null : denied.error.message).toMatch(/access/i);

    const visible = await store
      .getState()
      .actions.status.rename(bob, BACKLOG_TODO, "Up next");

    expect(visible.ok ? null : visible.error.message).toMatch(/permission/i);
  });
});

describe("reorderStatus", () => {
  it("moves a status to the head of its list's set", async () => {
    const store = createTestStore();

    const moved = unwrap(
      await store.getState().actions.status.reorder(alice, BACKLOG_DONE, 0),
    );

    expect(backlogStatuses(store).map((status) => status.id)).toEqual([
      BACKLOG_DONE,
      BACKLOG_TODO,
      "st-bk-active",
    ]);

    // The position is resolved against the *remaining* siblings, so landing at
    // index 0 means a value below the previous first rather than a renumber.
    const todo = store.getState().statuses[BACKLOG_TODO];

    expect(moved.position).toBeLessThan(todo?.position ?? 0);
  });

  it("moves a status into the middle", async () => {
    const store = createTestStore();

    await store.getState().actions.status.reorder(alice, BACKLOG_DONE, 1);

    expect(backlogStatuses(store).map((status) => status.id)).toEqual([
      BACKLOG_TODO,
      BACKLOG_DONE,
      "st-bk-active",
    ]);
  });

  it("keeps a status at the tail when the index is past the end", async () => {
    const store = createTestStore();

    await store
      .getState()
      .actions.status.reorder(alice, BACKLOG_TODO, Number.MAX_SAFE_INTEGER);

    expect(backlogStatuses(store).map((status) => status.id)).toEqual([
      "st-bk-active",
      BACKLOG_DONE,
      BACKLOG_TODO,
    ]);
  });

  /*
   * Siblings are filtered to the same `listId`, so Sprint 14's four statuses
   * cannot pull Backlog's three out of order — the bug an unfiltered
   * `Object.values(draft.statuses)` would introduce.
   */
  it("orders against its own list's statuses only", async () => {
    const store = createTestStore();
    const sprintBefore = selectStatusesForList(
      store.getState(),
      alice,
      SEED_IDS.lists.sprint14,
    ).map((status) => status.id);

    await store.getState().actions.status.reorder(alice, BACKLOG_DONE, 0);

    expect(
      selectStatusesForList(
        store.getState(),
        alice,
        SEED_IDS.lists.sprint14,
      ).map((status) => status.id),
    ).toEqual(sprintBefore);
  });

  it("reports an unknown status as NOT_FOUND", async () => {
    const store = createTestStore();

    const result = await store
      .getState()
      .actions.status.reorder(alice, "st-gone", 0);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("NOT_FOUND");
  });

  it("refuses a member and leaves the order untouched", async () => {
    const store = createTestStore();
    const before = domainSnapshot(store);

    const result = await store
      .getState()
      .actions.status.reorder(bob, BACKLOG_DONE, 0);

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(domainSnapshot(store)).toEqual(before);
  });
});

/*
 * There is deliberately no `create` or `delete` on this slice: creation happens
 * inside `containerSlice.create` so a list and its statuses land together
 * (Requirement 3.3.1), and nothing may take a list below the one-per-category
 * minimum. Asserting the surface is narrow is what stops either being added
 * without the invariant being reconsidered.
 */
describe("the slice's surface", () => {
  it("offers rename and reorder and nothing else", () => {
    const store = createTestStore();

    expect(Object.keys(store.getState().actions.status).sort()).toEqual([
      "rename",
      "reorder",
    ]);
  });
});

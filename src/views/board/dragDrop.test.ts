import { describe, expect, it } from "vitest";

import {
  columnIdOf,
  columnIdOfTarget,
  columnsFromPlan,
  isNoOpDrop,
  locate,
  planFrom,
  type DragPlan,
  type PlannableColumn,
} from "./dragDrop";

/**
 * The mid-drag order, and reading a commit back out of it.
 *
 * A real drag needs layout and jsdom has none, which is exactly why the
 * cross-column bugs here have survived a green suite several times over. The
 * arithmetic is extracted so the part that was actually wrong — which column,
 * which index, and whether to write anything at all — is testable without a
 * browser.
 *
 * The *rearranging* is no longer tested here, because it is no longer ours:
 * dnd-kit's `move` helper decides where the card goes, from the live drag
 * operation's geometry. What is tested is the bookkeeping either side of it.
 */

interface Task {
  readonly id: string;
}

/** To do: a, b, c · In progress: d, e · Done: (empty) */
function board(): PlannableColumn<Task>[] {
  return [
    { statusId: "todo", tasks: [{ id: "a" }, { id: "b" }, { id: "c" }] },
    { statusId: "active", tasks: [{ id: "d" }, { id: "e" }] },
    { statusId: "done", tasks: [] },
  ];
}

const plan = (): DragPlan => planFrom(board());

/** Readable shape for assertions. */
function shape(value: DragPlan) {
  return Object.entries(value).map(([statusId, ids]) => [
    statusId,
    ids.join(","),
  ]);
}

describe("planFrom", () => {
  it("captures the board as ordered ids per column", () => {
    expect(shape(plan())).toEqual([
      ["todo", "a,b,c"],
      ["active", "d,e"],
      ["done", ""],
    ]);
  });

  /* An empty column is still a key, which is what makes it a drop target. */
  it("keeps a key for an empty column", () => {
    expect(Object.hasOwn(plan(), "done")).toBe(true);
  });
});

describe("columnIdOf", () => {
  it("resolves a task to its column", () => {
    expect(columnIdOf(plan(), "e")).toBe("active");
    expect(columnIdOf(plan(), "a")).toBe("todo");
  });

  it("is null for a task the plan has never heard of", () => {
    expect(columnIdOf(plan(), "nonsense")).toBeNull();
  });
});

describe("locate", () => {
  it("finds a card's column and position", () => {
    expect(locate(plan(), "c")).toEqual({ statusId: "todo", index: 2 });
    expect(locate(plan(), "d")).toEqual({ statusId: "active", index: 0 });
  });

  it("is null for an unknown card", () => {
    expect(locate(plan(), "zzz")).toBeNull();
  });

  /*
   * The case that was silently broken: a card dragged into an *empty* column.
   * Nothing collides there except the column itself, so the destination can
   * only come from the plan — reading it off the dragged card's own sortable
   * group, as an earlier version did, left it pointing at the column it came
   * from and the drop wrote nothing (Requirement 4.9).
   */
  it("commits a card dropped into a previously empty column", () => {
    const current: DragPlan = {
      todo: ["b", "c"],
      active: ["d", "e"],
      done: ["a"],
    };

    expect(locate(current, "a")).toEqual({ statusId: "done", index: 0 });
    expect(isNoOpDrop(board(), "a", locate(current, "a"))).toBe(false);
  });

  /*
   * And the behaviour originally reported missing: a card dragged into the
   * middle of a populated column commits that middle position, rather than
   * landing at the top and needing a second drag to sort it.
   */
  it("commits a cross-column drop at the position it was dragged to", () => {
    const current: DragPlan = {
      todo: ["b", "c"],
      active: ["d", "a", "e"],
      done: [],
    };

    expect(locate(current, "a")).toEqual({ statusId: "active", index: 1 });
  });
});

describe("isNoOpDrop", () => {
  it("is true when the card lands where it started", () => {
    expect(isNoOpDrop(board(), "b", { statusId: "todo", index: 1 })).toBe(true);
  });

  it("is true for a null target", () => {
    expect(isNoOpDrop(board(), "a", null)).toBe(true);
  });

  it("is false for a real move", () => {
    expect(isNoOpDrop(board(), "a", { statusId: "active", index: 0 })).toBe(
      false,
    );
    expect(isNoOpDrop(board(), "a", { statusId: "todo", index: 2 })).toBe(
      false,
    );
  });

  /*
   * The keyboard path: Space to pick up, Space to drop, no arrow key in
   * between. Nothing should be written, for any card.
   */
  it("treats pick-up-and-drop as no change for every card", () => {
    const current = plan();

    for (const id of ["a", "b", "c", "d", "e"]) {
      expect(isNoOpDrop(board(), id, locate(current, id))).toBe(true);
    }
  });
});

describe("columnsFromPlan", () => {
  it("renders the plan's order", () => {
    const rendered = columnsFromPlan(board(), {
      todo: ["b", "c"],
      active: ["d", "a", "e"],
      done: [],
    });

    expect(
      rendered.map((column) => [
        column.statusId,
        column.tasks.map((task) => task.id).join(","),
      ]),
    ).toEqual([
      ["todo", "b,c"],
      ["active", "d,a,e"],
      ["done", ""],
    ]);
  });

  it("returns the columns untouched with no plan", () => {
    const columns = board();

    expect(columnsFromPlan(columns, null)).toBe(columns);
  });

  /*
   * Columns the drag has not touched keep their object identity, so a crossing
   * re-renders two columns rather than the whole board — which is most of the
   * difference between a smooth drag and a stuttering one.
   */
  it("preserves the identity of untouched columns", () => {
    const columns = board();
    const rendered = columnsFromPlan(columns, {
      todo: ["b", "c"],
      active: ["d", "a", "e"],
      done: [],
    });

    expect(rendered[2]).toBe(columns[2]);
    expect(rendered[0]).not.toBe(columns[0]);
    expect(rendered[1]).not.toBe(columns[1]);
  });

  it("preserves every column's identity when the plan matches the board", () => {
    const columns = board();
    const rendered = columnsFromPlan(columns, planFrom(columns));

    for (const [index, column] of columns.entries()) {
      expect(rendered[index]).toBe(column);
    }
  });
});

describe("columnIdOfTarget", () => {
  /*
   * Dragging into a populated column collides with one of its *cards*, so the
   * column itself is never the target — which is why the highlight cannot be
   * driven by a column's own flag (Requirement 4.6).
   */
  it("resolves a card target to the column it sits in", () => {
    expect(columnIdOfTarget({ id: "task-9", group: "active" })).toBe("active");
  });

  /* A column's empty space, and the only target an empty column has (4.9). */
  it("resolves a column target to itself", () => {
    expect(columnIdOfTarget({ id: "done" })).toBe("done");
  });

  it("is null when the drag is over nothing", () => {
    expect(columnIdOfTarget(null)).toBeNull();
    expect(columnIdOfTarget(undefined)).toBeNull();
  });
});

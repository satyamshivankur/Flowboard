import { describe, expect, it } from "vitest";

import {
  columnIdOf,
  columnsFromPlan,
  crossColumnMove,
  finalDrop,
  indexInColumn,
  isNoOpDrop,
  planFrom,
  sameTarget,
  type DragPlan,
  type PlannableColumn,
} from "./dragPlan";

/**
 * Drop planning.
 *
 * A real drag needs layout and jsdom has none, which is exactly why the
 * cross-column bugs here survived a green suite three times over. Extracting
 * the arithmetic makes the part that was actually wrong testable without a
 * browser — including the loop guard, which is a property of these functions
 * returning the *same object* when nothing changed.
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
});

describe("columnIdOf", () => {
  it("resolves a task id to its column", () => {
    expect(columnIdOf(plan(), "e")).toBe("active");
  });

  /*
   * dnd-kit reports whichever droppable the pointer is over — a card, or a
   * column's empty space. Both have to resolve, or the highlight and the drop
   * disagree about where the card is going.
   */
  it("resolves a column id to itself", () => {
    expect(columnIdOf(plan(), "done")).toBe("done");
  });

  it("is undefined for anything else", () => {
    expect(columnIdOf(plan(), "nonsense")).toBeUndefined();
  });
});

describe("indexInColumn", () => {
  it("finds a card's position", () => {
    expect(indexInColumn(plan(), "c")).toBe(2);
    expect(indexInColumn(plan(), "d")).toBe(0);
  });

  it("is -1 for an unknown card", () => {
    expect(indexInColumn(plan(), "zzz")).toBe(-1);
  });
});

describe("crossColumnMove", () => {
  /*
   * The loop guard, and the single most important property in this file.
   * Returning the same object is what lets the caller pass this straight to
   * `setState` and have React bail out — no re-render, so no re-measure, so no
   * further `onDragOver`. Without it the board crashed with "Maximum update
   * depth exceeded".
   */
  it("returns the identical plan for a move within one column", () => {
    const current = plan();

    expect(crossColumnMove(current, "a", "c")).toBe(current);
    expect(crossColumnMove(current, "a", "todo")).toBe(current);
    expect(crossColumnMove(current, "a", "a")).toBe(current);
  });

  it("returns the identical plan for ids it cannot resolve", () => {
    const current = plan();

    expect(crossColumnMove(current, "a", "nonsense")).toBe(current);
    expect(crossColumnMove(current, "nonsense", "d")).toBe(current);
  });

  it("inserts before the hovered card in the destination", () => {
    expect(shape(crossColumnMove(plan(), "a", "e"))).toEqual([
      ["todo", "b,c"],
      ["active", "d,a,e"],
      ["done", ""],
    ]);
  });

  it("inserts after the hovered card past its midpoint", () => {
    expect(shape(crossColumnMove(plan(), "a", "e", true))).toEqual([
      ["todo", "b,c"],
      ["active", "d,e,a"],
      ["done", ""],
    ]);
  });

  it("can reach the top of the destination", () => {
    expect(shape(crossColumnMove(plan(), "a", "d"))).toEqual([
      ["todo", "b,c"],
      ["active", "a,d,e"],
      ["done", ""],
    ]);
  });

  it("appends when over a column's empty space", () => {
    expect(shape(crossColumnMove(plan(), "a", "active"))).toEqual([
      ["todo", "b,c"],
      ["active", "d,e,a"],
      ["done", ""],
    ]);
  });

  it("moves into an empty column", () => {
    expect(shape(crossColumnMove(plan(), "a", "done"))).toEqual([
      ["todo", "b,c"],
      ["active", "d,e"],
      ["done", "a"],
    ]);
  });

  /*
   * The property that makes the handler safe to call on every pointer event:
   * crossing once then hovering around inside the destination produces no
   * further plan changes.
   */
  it("settles after one crossing", () => {
    const first = crossColumnMove(plan(), "a", "e");

    for (const overId of ["d", "e", "a", "active"]) {
      expect(crossColumnMove(first, "a", overId)).toBe(first);
    }
  });
});

describe("finalDrop", () => {
  it("commits the index the card already occupies in the plan", () => {
    const current = crossColumnMove(plan(), "a", "e");

    // The plan reads d,a,e — so dropping on `a` itself commits index 1.
    expect(finalDrop(current, "a", "a")).toEqual({
      statusId: "active",
      index: 1,
    });
  });

  /*
   * Within-column reordering is the case `onDragOver` deliberately ignores, so
   * this is the only place it is resolved. No midpoint adjustment: the sorting
   * strategy has already displaced the cards so the dragged one *appears* at
   * the hovered index, and adding half a card on top would commit one slot
   * away from what is on screen.
   */
  it("resolves a within-column reorder from the hovered card", () => {
    expect(finalDrop(plan(), "a", "c")).toEqual({
      statusId: "todo",
      index: 2,
    });
    expect(finalDrop(plan(), "c", "a")).toEqual({
      statusId: "todo",
      index: 0,
    });
  });

  it("commits the end of the column when dropped on the column itself", () => {
    expect(finalDrop(plan(), "a", "todo")).toEqual({
      statusId: "todo",
      index: 2,
    });
  });

  it("falls back to the card's own position for an unknown over id", () => {
    expect(finalDrop(plan(), "b", "nonsense")).toEqual({
      statusId: "todo",
      index: 1,
    });
  });

  it("is null for an unknown card", () => {
    expect(finalDrop(plan(), "zzz", "a")).toBeNull();
  });

  /*
   * End to end, and the behaviour the user reported missing: a card dragged
   * into the middle of another column commits that middle position, rather
   * than needing a second drag to sort it.
   */
  it("places a cross-column drop at the position it was dragged to", () => {
    const afterOver = crossColumnMove(plan(), "a", "e");
    const target = finalDrop(afterOver, "a", "a");

    expect(target).toEqual({ statusId: "active", index: 1 });

    // And the plan on screen agrees with the committed index.
    expect(indexInColumn(afterOver, "a")).toBe(target?.index);
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
   * The keyboard path: Space to pick up, Space to drop, without moving. The
   * card is reported as its own `over`, and nothing should be written.
   */
  it("treats pick-up-and-drop as no change for every card", () => {
    const current = plan();

    for (const id of ["a", "b", "c", "d", "e"]) {
      expect(isNoOpDrop(board(), id, finalDrop(current, id, id))).toBe(true);
    }
  });
});

describe("sameTarget", () => {
  it("compares by value, not by reference", () => {
    expect(
      sameTarget(
        { statusId: "todo", index: 1 },
        { statusId: "todo", index: 1 },
      ),
    ).toBe(true);
  });

  it("separates a different column from a different index", () => {
    expect(
      sameTarget(
        { statusId: "todo", index: 1 },
        { statusId: "active", index: 1 },
      ),
    ).toBe(false);
    expect(
      sameTarget(
        { statusId: "todo", index: 1 },
        { statusId: "todo", index: 2 },
      ),
    ).toBe(false);
  });

  it("handles null on either side", () => {
    expect(sameTarget(null, null)).toBe(true);
    expect(sameTarget(null, { statusId: "todo", index: 0 })).toBe(false);
  });
});

describe("columnsFromPlan", () => {
  it("renders the plan's order", () => {
    const current = crossColumnMove(plan(), "a", "e");
    const rendered = columnsFromPlan(board(), current);

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
   * Columns the drag has not touched keep their object identity, so dragging
   * does not remount every card on the board — which is most of the difference
   * between a smooth drag and a stuttering one.
   */
  it("preserves the identity of untouched columns", () => {
    const columns = board();
    const rendered = columnsFromPlan(
      columns,
      crossColumnMove(plan(), "a", "e"),
    );

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

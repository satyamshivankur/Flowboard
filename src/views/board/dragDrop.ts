/**
 * The board's task order while a drag is live, as pure functions.
 *
 * ## Why React has to hold this at all
 *
 * dnd-kit previews a cross-list drag by *physically moving the DOM node* —
 * `OptimisticSortingPlugin` ends in `targetElement.insertAdjacentElement(...)`,
 * which lifts the dragged card out of one column's DOM and inserts it into
 * another's. That is fine for a vanilla app and fatal for a React one: React
 * still believes the node is a child of the column it rendered it into, so the
 * next time that column re-renders it calls `removeChild` on a node that is no
 * longer there and throws
 *
 *   NotFoundError: Failed to execute 'removeChild' on 'Node'
 *
 * dnd-kit's answer is not to fight this but to hand the move to React, and it
 * checks for exactly that: before touching the DOM the plugin snapshots every
 * sortable's index, waits for the renderer, and bails out if anything changed
 * in the meantime (`hasChanged`). So an app that mirrors the move into state
 * during `onDragOver` gets the preview *and* keeps React the sole owner of the
 * tree, because dnd-kit stands down.
 *
 * This module is that mirror. It is not the hand-rolled planner that used to
 * live here: the arithmetic of deciding where the card goes belongs to
 * dnd-kit's `move` helper, which resolves it from the live drag operation's own
 * geometry. What is left here is bookkeeping — capture the order, read a
 * position back out of it, render it.
 *
 * ## The other thing `move` fixes
 *
 * An empty column has no cards, so the thing the pointer collides with is the
 * column's own droppable rather than a sortable. dnd-kit's optimistic sorting
 * ignores that case outright (`if (!isSortable(target)) return`), and so did
 * the previous version of this file's commit path, which read the destination
 * off the dragged sortable's `group`. Nothing ever updated that group, so a
 * drop into an empty column silently did nothing at all.
 *
 * `move` handles it: a target that is a *key* of the record, rather than an
 * item in one, inserts at the top or bottom of that column depending on which
 * side of its centre the pointer is.
 *
 * Kept free of dnd-kit and React so it can be tested directly: a real drag
 * needs layout, and jsdom has none — which is why the cross-column bugs here
 * have survived a green suite several times over.
 */

/**
 * Ordered task ids per column, keyed by status id.
 *
 * Mutable arrays, which is not an oversight: this is the shape dnd-kit's `move`
 * helper accepts, and it returns a new record rather than editing this one.
 */
export type DragPlan = Record<string, string[]>;

/** Where a dropped card should be committed. */
export interface DropTarget {
  /** The destination column. */
  readonly statusId: string;
  /**
   * The card's index in that column, counting the card itself.
   *
   * The Model's `positionForIndex` receives the destination column *excluding*
   * the moved task, and inserting at this index reproduces the order on
   * screen — so the number the user watched the card settle into is the number
   * that gets written.
   */
  readonly index: number;
}

/** The shape of a board column this module needs. */
export interface PlannableColumn<T extends { readonly id: string }> {
  readonly statusId: string;
  readonly tasks: readonly T[];
}

/** The board's current order, captured at the start of a drag. */
export function planFrom<T extends { readonly id: string }>(
  columns: readonly PlannableColumn<T>[],
): DragPlan {
  return Object.fromEntries(
    columns.map((column) => [column.statusId, column.tasks.map((t) => t.id)]),
  );
}

/** The column a task sits in, or `null` if the plan has never heard of it. */
export function columnIdOf(plan: DragPlan, taskId: string): string | null {
  return (
    Object.keys(plan).find((statusId) => plan[statusId]?.includes(taskId)) ??
    null
  );
}

/**
 * Where a task currently sits in the plan.
 *
 * This is what gets committed, because the plan is what is rendered — so the
 * index written is the one the user watched the card settle into. Resolving it
 * from geometry at drop time instead is what used to disagree with the board
 * in front of them and land every cross-column drop at the top of a column.
 */
export function locate(plan: DragPlan, taskId: string): DropTarget | null {
  const statusId = columnIdOf(plan, taskId);

  if (statusId === null) return null;

  const index = plan[statusId]?.indexOf(taskId) ?? -1;

  return index === -1 ? null : { statusId, index };
}

/**
 * True when committing `target` would change nothing.
 *
 * Dropping a card back where it started should write nothing at all — not a
 * mutation, not a position, not a toast (Requirement 4.7). Compared against
 * the board's *original* columns, since the plan has been rearranged by then.
 * The keyboard path hits this on every pick-up-and-drop without an arrow key
 * in between.
 */
export function isNoOpDrop<T extends { readonly id: string }>(
  columns: readonly PlannableColumn<T>[],
  taskId: string,
  target: DropTarget | null,
): boolean {
  if (target === null) return true;

  const original = locate(planFrom(columns), taskId);

  if (original === null) return false;

  return (
    original.statusId === target.statusId && original.index === target.index
  );
}

/**
 * The columns as the plan describes them, for rendering mid-drag.
 *
 * Untouched columns keep their object identity, so a crossing re-renders the
 * two columns involved and leaves the rest of the board — and all of their
 * cards, with their pickers and their twenty-item menus — alone.
 */
export function columnsFromPlan<
  T extends { readonly id: string },
  C extends PlannableColumn<T>,
>(columns: readonly C[], plan: DragPlan | null): readonly C[] {
  if (plan === null) return columns;

  const byId = new Map(
    columns.flatMap((column) => column.tasks.map((task) => [task.id, task])),
  );

  return columns.map((column) => {
    const ids = plan[column.statusId];

    if (ids === undefined) return column;

    const unchanged =
      ids.length === column.tasks.length &&
      ids.every((id, index) => column.tasks[index]?.id === id);

    if (unchanged) return column;

    const tasks = ids
      .map((id) => byId.get(id))
      .filter((task): task is T => task !== undefined);

    return { ...column, tasks } satisfies PlannableColumn<T>;
  });
}

/**
 * The droppable the pointer is over, reduced to the column it belongs to.
 *
 * Only used for the spoken announcement, which has to answer before the plan
 * has been rebuilt. A card carries its column in `group`; a column is its own
 * answer.
 */
export function columnIdOfTarget(
  target:
    | {
        readonly id: string | number;
        readonly group?: string | number | undefined;
      }
    | null
    | undefined,
): string | null {
  if (!target) return null;

  return String(target.group ?? target.id);
}

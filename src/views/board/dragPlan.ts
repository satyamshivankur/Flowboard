/**
 * Drop planning for the board, as pure functions.
 *
 * ## Why this exists
 *
 * Cross-column dragging has been wrong three times, each for a different
 * reason, and the history is worth keeping because the fixes look similar and
 * are not.
 *
 * 1. **No `onDragOver` at all.** Nothing happened between pickup and drop, so
 *    the destination column never highlighted unless it was empty, the
 *    destination's cards never parted to make room, and the index was resolved
 *    at drop time from the dragged card's corners — which in a non-empty
 *    column is nearly always the first card. Hence "it always lands at the
 *    top".
 *
 * 2. **A preview resolved against the wrong list.** The board rendered the
 *    move as though it had happened, but resolved `over` against the *store's*
 *    columns while displaying the *previewed* ones. That is not a fixed point:
 *    relocating the card changes which card is under the pointer, which maps
 *    to a different index in the original list, which moves the card again.
 *    Combined with a fresh object on every event it ran away — "Maximum update
 *    depth exceeded" — and crashed the app.
 *
 * 3. **No preview.** Stable, but it threw away both the insertion feedback and
 *    the cross-column index, so a card had to be dropped into a column and
 *    then sorted in a second drag.
 *
 * ## The shape that actually works
 *
 * dnd-kit's own multiple-containers recipe, which sidesteps (2) by making the
 * plan self-referential in the right direction: the plan *is* the rendered
 * state, and `over` is resolved against the plan rather than against the
 * store.
 *
 * The stability comes from one rule: **`onDragOver` only ever moves a card
 * between columns, never within one.** Once the card is in the destination,
 * the active and over columns match and the handler returns the plan
 * unchanged — React bails out, nothing re-renders, nothing re-measures, the
 * loop has no fuel. Reordering *inside* a column is left to
 * `verticalListSortingStrategy`, which does it with transforms and no React
 * state at all, and is committed once on drop.
 *
 * Kept free of dnd-kit and React so it can be tested directly: a real drag
 * needs layout, and jsdom has none — which is why every one of these bugs
 * survived a green suite.
 */

/** Ordered task ids per column, keyed by status id. */
export type DragPlan = Readonly<Record<string, readonly string[]>>;

/** The shape of a board column this planner needs. */
export interface PlannableColumn<T extends { readonly id: string }> {
  readonly statusId: string;
  readonly tasks: readonly T[];
}

export interface DropTarget {
  readonly statusId: string;
  /**
   * The card's index in its destination column, counting the card itself.
   *
   * The Model's `positionForIndex` receives the destination column *excluding*
   * the moved task, and inserting at this index reproduces the order shown —
   * so the number the user watched is the number that gets written.
   */
  readonly index: number;
}

export function planFrom<T extends { readonly id: string }>(
  columns: readonly PlannableColumn<T>[],
): DragPlan {
  return Object.fromEntries(
    columns.map((column) => [column.statusId, column.tasks.map((t) => t.id)]),
  );
}

/**
 * The column an id belongs to.
 *
 * `id` may be a task id or a column's own status id, because dnd-kit reports
 * whichever droppable the pointer is over — a card, or a column's empty space.
 * Both have to resolve, or the highlight and the drop disagree.
 */
export function columnIdOf(plan: DragPlan, id: string): string | undefined {
  if (Object.hasOwn(plan, id)) return id;

  return Object.keys(plan).find((statusId) => plan[statusId]?.includes(id));
}

/** Index of `taskId` within its column, or -1. */
export function indexInColumn(plan: DragPlan, taskId: string): number {
  const statusId = columnIdOf(plan, taskId);

  if (statusId === undefined) return -1;

  return plan[statusId]?.indexOf(taskId) ?? -1;
}

/**
 * Moves the dragged card into the column it is now over.
 *
 * Returns the **same plan object** when nothing should change, which is what
 * lets the caller hand it straight to `setState` and have React bail out. That
 * early return is the whole defence against the update loop: within a column
 * this does nothing, so a drag that stays put stops producing renders.
 */
export function crossColumnMove(
  plan: DragPlan,
  activeId: string,
  overId: string,
  isBelowMidpoint = false,
): DragPlan {
  const from = columnIdOf(plan, activeId);
  const to = columnIdOf(plan, overId);

  if (from === undefined || to === undefined) return plan;

  // Within one column: `verticalListSortingStrategy` owns this, not React.
  if (from === to) return plan;

  const source = plan[from] ?? [];
  const destination = plan[to] ?? [];

  const insertAt =
    overId === to
      ? // Over the column's empty space: append.
        destination.length
      : destination.indexOf(overId) + (isBelowMidpoint ? 1 : 0);

  const clamped = Math.max(0, Math.min(insertAt, destination.length));

  return {
    ...plan,
    [from]: source.filter((id) => id !== activeId),
    [to]: [
      ...destination.slice(0, clamped),
      activeId,
      ...destination.slice(clamped),
    ],
  };
}

/**
 * Where the drag should finally land.
 *
 * By drop time the card is already in its destination column — `onDragOver`
 * put it there — so this only resolves the index within that column, which is
 * the one thing `verticalListSortingStrategy` was handling visually rather
 * than in state.
 *
 * No midpoint adjustment here, deliberately: the strategy has already
 * displaced the cards so that the dragged card *appears* at the hovered
 * index, and adding half a card's offset on top would commit one slot away
 * from what is on screen.
 */
export function finalDrop(
  plan: DragPlan,
  activeId: string,
  overId: string,
): DropTarget | null {
  const statusId = columnIdOf(plan, activeId);

  if (statusId === undefined) return null;

  const list = plan[statusId] ?? [];
  const activeIndex = list.indexOf(activeId);

  if (activeIndex === -1) return null;

  // Over the column itself rather than a card: the end of it.
  if (overId === statusId) {
    return { statusId, index: Math.max(0, list.length - 1) };
  }

  const overIndex = list.indexOf(overId);

  if (overIndex === -1) return { statusId, index: activeIndex };

  return { statusId, index: overIndex };
}

/** Whether two drop targets mean the same thing. */
export function sameTarget(
  a: DropTarget | null,
  b: DropTarget | null,
): boolean {
  if (a === null || b === null) return a === b;

  return a.statusId === b.statusId && a.index === b.index;
}

/**
 * True when committing `target` would change nothing.
 *
 * Dropping a card back where it started should write nothing at all — not a
 * mutation, not a position, not a toast (Requirement 4.7). Compared against
 * the board's *original* columns, since the plan has already been rearranged.
 */
export function isNoOpDrop<T extends { readonly id: string }>(
  columns: readonly PlannableColumn<T>[],
  activeId: string,
  target: DropTarget | null,
): boolean {
  if (target === null) return true;

  const original = planFrom(columns);
  const statusId = columnIdOf(original, activeId);

  if (statusId === undefined) return false;

  return (
    statusId === target.statusId &&
    indexInColumn(original, activeId) === target.index
  );
}

/**
 * The columns as the plan describes them, for rendering mid-drag.
 *
 * Relocating the card into the destination's own task list is what puts it
 * inside that column's `SortableContext` — the only way the sorting strategy
 * will open a gap for it (Requirement 4.6, 15.6).
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

    // Untouched columns keep their identity, so React does not remount them.
    if (unchanged) return column;

    const tasks = ids
      .map((id) => byId.get(id))
      .filter((task): task is T => task !== undefined);

    return { ...column, tasks } satisfies PlannableColumn<T>;
  });
}

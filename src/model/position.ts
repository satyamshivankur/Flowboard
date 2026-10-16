import { POSITION_GAP, POSITION_MIN_GAP } from "@/config/limits";

/**
 * Fractional indexing.
 *
 * Siblings are ordered by a floating-point `position` rather than by a stored
 * array, so inserting or reordering writes exactly one entity instead of
 * renumbering every sibling. Inserting between two neighbours takes their
 * midpoint.
 *
 * The cost is finite precision: repeated midpoint insertion at the same spot
 * eventually exhausts it. `needsRebalance` detects that and `rebalance`
 * respaces the group — rare in practice, and covered by tests rather than
 * hoped for.
 */

/** Anything orderable by position. */
export interface Positioned {
  readonly position: number;
}

/**
 * A position between two neighbours. Either may be `null` at an edge:
 * `(null, first)` prepends, `(last, null)` appends, `(null, null)` is the first
 * item in an empty group.
 */
export function positionBetween(
  prev: number | null,
  next: number | null,
): number {
  if (prev === null && next === null) return POSITION_GAP;
  if (prev === null) return (next as number) - POSITION_GAP;
  if (next === null) return prev + POSITION_GAP;
  return (prev + next) / 2;
}

/** True when the gap between neighbours has collapsed below usable precision. */
export function needsRebalance(
  prev: number | null,
  next: number | null,
): boolean {
  if (prev === null || next === null) return false;
  return Math.abs(next - prev) < POSITION_MIN_GAP;
}

/** Evenly spaced positions for `count` items, starting at `POSITION_GAP`. */
export function rebalance(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * POSITION_GAP);
}

/** Comparator for `Array.prototype.sort`. Ties break on nothing — see note. */
export function byPosition(a: Positioned, b: Positioned): number {
  return a.position - b.position;
}

/**
 * Sorted copy of `items` by position.
 *
 * Equal positions fall back to id order so the result is deterministic. Without
 * that, two siblings sharing a position would render in whatever order
 * `Object.values` happened to produce, which varies with insertion history and
 * would make tests flaky for reasons that look like logic bugs.
 */
export function sortByPosition<T extends Positioned & { readonly id: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );
}

/**
 * The position an item should take when dropped at `index` within an ordered
 * group, where `sorted` excludes the item being moved.
 *
 * Callers pass the destination index from the drag-and-drop handler; this
 * resolves the surrounding neighbours and returns their midpoint.
 */
export function positionForIndex(
  sorted: readonly Positioned[],
  index: number,
): number {
  const clamped = Math.max(0, Math.min(index, sorted.length));
  const prev = clamped === 0 ? null : (sorted[clamped - 1]?.position ?? null);
  const next =
    clamped >= sorted.length ? null : (sorted[clamped]?.position ?? null);

  return positionBetween(prev, next);
}

/** The position that appends to an ordered group. */
export function positionAtEnd(sorted: readonly Positioned[]): number {
  const last = sorted[sorted.length - 1];
  return positionBetween(last?.position ?? null, null);
}

/** The position that prepends to an ordered group. */
export function positionAtStart(sorted: readonly Positioned[]): number {
  const first = sorted[0];
  return positionBetween(null, first?.position ?? null);
}

/**
 * Whether a group needs respacing before the next insertion at `index`.
 * The Controller calls this after computing a drop position so it can rebalance
 * in the same mutation rather than waiting for a failure.
 */
export function groupNeedsRebalance(
  sorted: readonly Positioned[],
  index: number,
): boolean {
  const clamped = Math.max(0, Math.min(index, sorted.length));
  const prev = clamped === 0 ? null : (sorted[clamped - 1]?.position ?? null);
  const next =
    clamped >= sorted.length ? null : (sorted[clamped]?.position ?? null);

  return needsRebalance(prev, next);
}

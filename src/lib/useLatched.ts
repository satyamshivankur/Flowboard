import { useState } from "react";

/**
 * Retains the last value seen while `active` was true.
 *
 * Exit animations need the props the element was *opened* with, but callers
 * routinely derive `open` and the content from one piece of state:
 *
 *   const [side, setSide] = useState<DrawerSide | null>(null);
 *   <Drawer open={side !== null} side={side ?? "right"} />
 *
 * `setSide(null)` flips `open` to false and collapses `side` to its default in
 * the same commit, so a left drawer animates out to the right. The same shape
 * blanks a confirm dialog's title mid-close when it comes from
 * `pending?.title ?? ""`.
 *
 * Latching here rather than demanding every caller keep two pieces of state
 * means the component cannot be held wrong. Once `active` goes false the value
 * freezes, so the leave transition finishes with what it started with; the next
 * open takes a fresh value.
 *
 * Implementation: a render-phase state update, which is React's documented way
 * to adjust state when a prop changes, guarded so it cannot loop. A ref written
 * during render would be shorter, but reading `ref.current` while rendering is
 * exactly what the React Compiler's `react-hooks/refs` rule forbids — and the
 * rule is right, since a discarded concurrent render would leave the ref
 * holding a value that was never committed.
 *
 * Cost: while `active` and given a value whose identity changes every render
 * (`children`, `footer`), this schedules one extra render pass. It cannot loop —
 * the second pass finds `latched === value` and stops — and one extra pass
 * while a modal is open is not worth optimising away.
 */
export function useLatched<T>(value: T, active: boolean): T {
  const [latched, setLatched] = useState(value);

  if (active && latched !== value) {
    setLatched(value);
  }

  return active ? value : latched;
}

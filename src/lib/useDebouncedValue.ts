import { useEffect, useState } from "react";

/**
 * A value that settles only after `delayMs` of quiet.
 *
 * Search runs over every task in the workspace on each keystroke. That is
 * cheap at this size and would not be at a realistic one, so the debounce is
 * here from the start rather than retrofitted once it hurts
 * (Requirement 23.2).
 *
 * The timer runs unconditionally, with no `delayMs <= 0` fast path. The fast
 * path would have to call `setState` directly in the effect body, which the
 * React Compiler's `set-state-in-effect` rule rejects — correctly, since that
 * is a render-triggering write with no event behind it.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return settled;
}

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "./useDebouncedValue";

/**
 * Fake timers here rather than real waiting: the point of a debounce is *when*
 * it settles, and a test that sleeps can only assert that it eventually does.
 */
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 200));

    expect(result.current).toBe("a");
  });

  it("holds the previous value until the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "ab" });

    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(199);
    });

    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe("ab");
  });

  /*
   * The property that makes it a debounce rather than a throttle: a steady
   * stream of changes produces no intermediate settled values at all.
   */
  it("settles once on the last value, not once per change", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 200),
      { initialProps: { value: "" } },
    );

    for (const value of ["r", "ro", "roa", "road"]) {
      rerender({ value });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current).toBe("");
    }

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe("road");
  });

  it("clears its timer on unmount", () => {
    const clear = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = renderHook(() => useDebouncedValue("a", 200));

    unmount();

    expect(clear).toHaveBeenCalled();

    clear.mockRestore();
  });
});

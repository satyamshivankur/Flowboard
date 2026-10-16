import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLatched } from "./useLatched";

describe("useLatched", () => {
  it("passes the value straight through while active", () => {
    const { result, rerender } = renderHook(
      ({ value, active }: { value: string; active: boolean }) =>
        useLatched(value, active),
      { initialProps: { value: "left", active: true } },
    );

    expect(result.current).toBe("left");

    rerender({ value: "bottom", active: true });

    expect(result.current).toBe("bottom");
  });

  /*
   * The reported bug, reduced to its essentials: a caller derives `open` and
   * `side` from one piece of state, so closing collapses `side` to its default
   * in the same commit. Without the latch the exit animation uses "right".
   */
  it("keeps the last active value when the value and active flip together", () => {
    const { result, rerender } = renderHook(
      ({ value, active }: { value: string; active: boolean }) =>
        useLatched(value, active),
      { initialProps: { value: "left", active: true } },
    );

    expect(result.current).toBe("left");

    // `setSide(null)` → open false and side back to its "right" default.
    rerender({ value: "right", active: false });

    expect(result.current).toBe("left");
  });

  it("stays frozen across re-renders while inactive", () => {
    const { result, rerender } = renderHook(
      ({ value, active }: { value: string; active: boolean }) =>
        useLatched(value, active),
      { initialProps: { value: "left", active: true } },
    );

    rerender({ value: "right", active: false });
    rerender({ value: "bottom", active: false });
    rerender({ value: "right", active: false });

    expect(result.current).toBe("left");
  });

  it("takes a fresh value on the next activation", () => {
    const { result, rerender } = renderHook(
      ({ value, active }: { value: string; active: boolean }) =>
        useLatched(value, active),
      { initialProps: { value: "left", active: true } },
    );

    rerender({ value: "right", active: false });

    expect(result.current).toBe("left");

    rerender({ value: "bottom", active: true });

    expect(result.current).toBe("bottom");
  });

  it("returns the initial value when it starts inactive", () => {
    const { result } = renderHook(() => useLatched("right", false));

    expect(result.current).toBe("right");
  });

  /*
   * The ConfirmHost shape: `pending?.title ?? ""`. Resolving the confirmation
   * nulls `pending`, so without the latch the title emptied itself for the
   * duration of the fade.
   */
  it("retains content that collapses to a fallback on close", () => {
    const { result, rerender } = renderHook(
      ({ title, open }: { title: string; open: boolean }) =>
        useLatched(title, open),
      {
        initialProps: {
          title: 'Delete "Wire up the auth guard"?',
          open: true,
        },
      },
    );

    rerender({ title: "", open: false });

    expect(result.current).toBe('Delete "Wire up the auth guard"?');
  });

  /*
   * `widthClassName` is optional, so the close commit can hand this `undefined`
   * rather than a different string. Typed explicitly because inference from
   * `initialProps` alone would pin the parameter to `string`.
   */
  it("handles undefined as a latched value", () => {
    const initialProps: { value: string | undefined; active: boolean } = {
      value: "md:w-drawer",
      active: true,
    };

    const { result, rerender } = renderHook(
      ({ value, active }: { value: string | undefined; active: boolean }) =>
        useLatched(value, active),
      { initialProps },
    );

    rerender({ value: undefined, active: false });

    expect(result.current).toBe("md:w-drawer");
  });
});

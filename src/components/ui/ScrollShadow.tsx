import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface ScrollShadowProps {
  readonly orientation?: "vertical" | "horizontal";
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Edge fades on a scrollable region.
 *
 * The fades appear only where there is actually more content, so they act as an
 * affordance rather than decoration — a permanently faded edge tells the user
 * nothing.
 *
 * Uses a scroll listener rather than `scroll-timeline`, which is not yet
 * supported widely enough to rely on for an affordance.
 */
export function ScrollShadow({
  orientation = "vertical",
  children,
  className,
}: ScrollShadowProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    function update() {
      if (!element) return;

      const isVertical = orientation === "vertical";
      const scroll = isVertical ? element.scrollTop : element.scrollLeft;
      const size = isVertical ? element.clientHeight : element.clientWidth;
      const total = isVertical ? element.scrollHeight : element.scrollWidth;

      setAtStart(scroll <= 1);
      // A 1px tolerance: fractional device pixel ratios mean the arithmetic
      // rarely lands exactly on the end.
      setAtEnd(scroll + size >= total - 1);
    }

    update();
    element.addEventListener("scroll", update, { passive: true });

    /*
     * Guarded: the fades are an affordance, so losing them where
     * ResizeObserver is unavailable is strictly better than throwing on mount
     * and taking the whole sidebar down with it.
     */
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);

    observer?.observe(element);

    return () => {
      element.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [orientation, children]);

  const isVertical = orientation === "vertical";

  return (
    /*
     * A flex **column**, not a plain block — and this is the load-bearing half
     * of the pair. It is what gives the scroller below a parent whose height
     * the flex algorithm resolves, so the scroller can be sized against that
     * used height instead of against a percentage that may be dropped. See the
     * comment on the scroller for what went wrong without it.
     */
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        className={cn(
          /*
           * `flex-1 min-h-0`, never `h-full`.
           *
           * `h-full` is `height: 100%`, and a percentage height resolves
           * against the containing block. When that block's own height is
           * *indefinite* the percentage is dropped and the element falls back
           * to sizing itself to its **content** — and a scroll container sized
           * to its own content has `scrollHeight === clientHeight`, so there
           * is nothing to scroll. The overflow is clipped by an ancestor
           * instead, and everything past the fold is unreachable.
           *
           * Not hypothetical, and not uniform: this component's own ancestor is
           * a flex item, so whether its height is definite depends on the
           * *caller*. The task drawer's desktop panel is `md:inset-y-0` — both
           * edges anchored, height definite, percentage resolved, no bug. Its
           * mobile bottom-sheet form is `bottom-0` with `max-h-[92dvh]` and no
           * `top`, so the height is auto-capped rather than definite and the
           * percentage silently became "as tall as the content". Measured at
           * 360x560 before the fix: the scroller overhung the slot it was
           * given by 193px, every pixel of that hidden behind the footer, with
           * `scrollHeight === clientHeight` and `scrollTop` pinned at 0. One
           * component, correct on one viewport and broken on the other.
           *
           * Flex sizing has no such failure mode. Given the flex-column parent
           * above, the flex algorithm sizes this item from that parent's *used*
           * height, and `min-h-0` lets it shrink below its content — which is
           * what creates the overflow, and therefore something to scroll. No
           * percentage, so nothing to drop.
           *
           * `overscroll-contain` keeps a flick at either end from chaining to
           * whatever is behind: on a phone the drawer is a sheet over the
           * board, and chaining there scrolls the board under the sheet.
           *
           * Held by `e2e/drawer-scroll.spec.ts`, which cannot be a jsdom test —
           * jsdom lays nothing out, so every rect is zero and neither the
           * percentage resolution nor `scrollHeight` exists there.
           */
          "min-h-0 flex-1 overscroll-contain",
          isVertical ? "overflow-y-auto" : "overflow-x-auto",
          className,
        )}
      >
        {children}
      </div>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute from-surface to-transparent",
          // The fades cross-fade as the region scrolls, so they need the
          // same reduced-motion guard as every other transition here
          // (Requirement 14.11).
          "transition-opacity duration-150 motion-reduce:transition-none",
          isVertical
            ? "inset-x-0 top-0 h-4 bg-gradient-to-b"
            : "inset-y-0 left-0 w-4 bg-gradient-to-r",
          atStart ? "opacity-0" : "opacity-100",
        )}
      />

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute from-surface to-transparent",
          // The fades cross-fade as the region scrolls, so they need the
          // same reduced-motion guard as every other transition here
          // (Requirement 14.11).
          "transition-opacity duration-150 motion-reduce:transition-none",
          isVertical
            ? "inset-x-0 bottom-0 h-4 bg-gradient-to-t"
            : "inset-y-0 right-0 w-4 bg-gradient-to-l",
          atEnd ? "opacity-0" : "opacity-100",
        )}
      />
    </div>
  );
}

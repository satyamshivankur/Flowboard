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
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        className={cn(
          "h-full",
          isVertical ? "overflow-y-auto" : "overflow-x-auto",
          className,
        )}
      >
        {children}
      </div>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute from-surface to-transparent transition-opacity",
          isVertical
            ? "inset-x-0 top-0 h-4 bg-gradient-to-b"
            : "inset-y-0 left-0 w-4 bg-gradient-to-r",
          atStart ? "opacity-0" : "opacity-100",
        )}
      />

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute from-surface to-transparent transition-opacity",
          isVertical
            ? "inset-x-0 bottom-0 h-4 bg-gradient-to-t"
            : "inset-y-0 right-0 w-4 bg-gradient-to-l",
          atEnd ? "opacity-0" : "opacity-100",
        )}
      />
    </div>
  );
}

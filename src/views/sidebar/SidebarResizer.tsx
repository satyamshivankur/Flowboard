import { useCallback, useEffect, useRef, useState } from "react";

import { SIDEBAR_WIDTH_RANGE_REM, useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/cn";

/** Root font size, so a pointer position in px can be expressed in rem. */
function rootFontSizePx(): number {
  const parsed = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
}

/**
 * Drag handle for the sidebar width.
 *
 * The pointer gives a position in CSS pixels, but the width is stored and
 * applied in `rem` — so it is converted against the *actual* root font size
 * rather than an assumed 16, keeping the sidebar consistent with every other
 * dimension for a user who has changed their browser font size
 * (Requirement 22.1).
 *
 * Keyboard-operable too: a drag handle that only responds to a pointer is
 * unreachable for anyone who cannot use one (Requirement 17.1).
 */
export function SidebarResizer() {
  const { widthRem, setWidthRem } = useSidebar();
  const [dragging, setDragging] = useState(false);
  const frame = useRef<number | null>(null);

  const apply = useCallback(
    (clientX: number) => {
      // Coalesce to one update per frame; pointermove outruns React otherwise.
      if (frame.current !== null) cancelAnimationFrame(frame.current);

      frame.current = requestAnimationFrame(() => {
        setWidthRem(clientX / rootFontSizePx());
      });
    },
    [setWidthRem],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      apply(event.clientX);
    };

    const onUp = () => {
      setDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // Selecting text while dragging a divider looks broken.
    document.body.classList.add("select-none");

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("select-none");

      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [dragging, apply]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={Math.round(widthRem)}
      aria-valuemin={SIDEBAR_WIDTH_RANGE_REM.min}
      aria-valuemax={SIDEBAR_WIDTH_RANGE_REM.max}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDoubleClick={() => {
        setWidthRem(SIDEBAR_WIDTH_RANGE_REM.default);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setWidthRem(widthRem - 1);
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          setWidthRem(widthRem + 1);
        }
      }}
      className={cn(
        "group absolute inset-y-0 right-0 w-1 cursor-col-resize",
        "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:-outline-offset-2",
        dragging && "bg-brand-600",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 right-0 w-px bg-border transition-colors",
          "can-hover:group-hover:bg-brand-600 can-hover:group-hover:w-0.5",
          "motion-reduce:transition-none",
          dragging && "bg-brand-600",
        )}
      />
    </div>
  );
}

import {
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useLayoutEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  readonly content: ReactNode;
  readonly side?: TooltipSide | undefined;
  /*
   * The `| undefined` is required by `exactOptionalPropertyTypes`: cloning with
   * `aria-describedby: undefined` to clear it is only assignable if the target
   * prop admits undefined explicitly.
   */
  readonly children: ReactElement<{
    "aria-describedby"?: string | undefined;
    onFocus?: (() => void) | undefined;
    onBlur?: (() => void) | undefined;
  }>;
  readonly className?: string | undefined;
}

/** Gap between trigger and tooltip, in rem. */
const GAP_REM = 0.375;

/**
 * Transform classes per side.
 *
 * Centring is done with a transform rather than by measuring the tooltip, so
 * one layout pass is enough — no read-then-write cycle against its own size.
 */
const TRANSFORM: Record<TooltipSide, string> = {
  top: "-translate-x-1/2 -translate-y-full",
  bottom: "-translate-x-1/2",
  left: "-translate-x-full -translate-y-1/2",
  right: "-translate-y-1/2",
};

interface Position {
  readonly top: number;
  readonly left: number;
}

/** Converts the rem gap against the real root font size, not an assumed 16. */
function gapPx(): number {
  const parsed = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );

  return GAP_REM * (Number.isFinite(parsed) && parsed > 0 ? parsed : 16);
}

function positionFor(rect: DOMRect, side: TooltipSide): Position {
  const gap = gapPx();
  const centreX = rect.left + rect.width / 2;
  const centreY = rect.top + rect.height / 2;

  switch (side) {
    case "top":
      return { left: centreX, top: rect.top - gap };
    case "bottom":
      return { left: centreX, top: rect.bottom + gap };
    case "left":
      return { left: rect.left - gap, top: centreY };
    case "right":
      return { left: rect.right + gap, top: centreY };
    default: {
      // Extending TooltipSide becomes a compile error here (Req 21.15).
      const exhaustive: never = side;
      return exhaustive;
    }
  }
}

/**
 * A hover/focus tooltip.
 *
 * **Rendered in a portal, positioned `fixed`.** An absolutely positioned
 * tooltip is clipped by any ancestor with `overflow` set, and `z-index` cannot
 * escape an overflow clip — so the previous version was cut off almost
 * everywhere in the app: tree rows sit inside the sidebar's scroll container,
 * card avatars inside a board column's, and everything inside the shell's
 * `overflow-hidden`. It only looked correct in Storybook, which has no
 * clipping ancestor.
 *
 * The coordinates are one of the two documented inline-`style` exceptions, the
 * other being the bottom sheet's drag offset (Requirement 13.4). A viewport
 * position computed from `getBoundingClientRect` cannot be expressed as a
 * utility class; the rem gap is still converted against the real root font size
 * so the spacing scales like everything else.
 *
 * Deliberately **not** shown on coarse pointers. A tooltip there either never
 * fires, or fires on tap and swallows the tap meant for the control — which is
 * why `IconButton` carries a required `label` rather than relying on this
 * (Requirement 20.10). The suppression is the `can-hover` variant rather than a
 * JavaScript check, so it costs nothing and cannot disagree with the CSS.
 */
export function Tooltip({
  content,
  side = "top",
  children,
  className,
}: TooltipProps) {
  const id = useId();
  /*
   * The trigger element is held in state via a callback ref, not in a `useRef`.
   * `measure` closes over it, and passing that callback into `cloneElement`
   * during render counts as reading a ref during render — which the React
   * Compiler rejects, correctly: a discarded concurrent render would leave the
   * ref holding an element that was never committed. State has no such problem.
   */
  const [trigger, setTrigger] = useState<HTMLSpanElement | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const measure = useCallback(() => {
    if (!trigger) return;

    setPosition(positionFor(trigger.getBoundingClientRect(), side));
  }, [trigger, side]);

  const show = useCallback(() => {
    measure();
  }, [measure]);

  const hide = useCallback(() => {
    setPosition(null);
  }, []);

  /*
   * A `fixed` tooltip does not move with its trigger, so scrolling would leave
   * it stranded. Re-measuring on scroll keeps them together; the listener is
   * only attached while one is visible, and at most one ever is.
   *
   * `capture: true` matters — scroll does not bubble, so a listener on window
   * would never see a nested scroll container without it.
   */
  useLayoutEffect(() => {
    if (position === null) return;

    window.addEventListener("scroll", measure, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
    };
  }, [position, measure]);

  if (!isValidElement(children)) return children;

  const visible = position !== null;

  return (
    <>
      {/*
        `inline-flex`, not `display: contents`. A `contents` element generates no
        box, so `getBoundingClientRect()` on it returns all zeros and the
        tooltip would anchor to the top-left of the viewport. This wrapper is
        the element being measured, so it has to be a real box — the previous
        version had an equivalent inner `inline-flex`, so the layout is
        unchanged.
      */}
      <span
        ref={setTrigger}
        className="inline-flex"
        onPointerEnter={show}
        onPointerLeave={hide}
      >
        {cloneElement(children, {
          "aria-describedby": visible ? id : undefined,
          onFocus: show,
          onBlur: hide,
        })}
      </span>

      {visible &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            /*
             * Viewport coordinates — the documented exception above. React
             * appends the unit, so there is no px literal in the source.
             */
            style={{ top: position.top, left: position.left }}
            className={cn(
              // `max-w` with wrapping rather than `whitespace-nowrap`: a long
              // truncated name is exactly what a tooltip is for, and nowrap
              // would push it off-screen instead of wrapping.
              "pointer-events-none fixed z-50 hidden max-w-64 text-pretty",
              "rounded-md bg-ink-900 px-2 py-1 text-xs font-medium text-white shadow-popover",
              // `hidden` by default and shown only where a real pointer exists,
              // so touch never gets a tooltip even though focus fires on tap.
              "can-hover:block",
              TRANSFORM[side],
              className,
            )}
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
}

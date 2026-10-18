import {
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import {
  resolveTooltipPlacement,
  type TooltipPlacement,
  type TooltipSide,
} from "@/lib/tooltipPlacement";

export type { TooltipSide };

export interface TooltipProps {
  readonly content: ReactNode;
  /**
   * Preferred side. A **preference**, not an instruction: the tooltip flips to
   * the opposite side when this one has no room, so a card at the top of a
   * column still gets a readable tooltip.
   */
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

/** Gap between trigger and tooltip, in rem — Radix's `sideOffset`. */
const GAP_REM = 0.375;

/**
 * Margin held from every viewport edge, in rem — Radix's `collisionPadding`,
 * which defaults to `0` there. A tooltip flush against the edge is legible but
 * looks like a rendering accident, and the inset costs nothing.
 */
const COLLISION_PADDING_REM = 0.5;

/**
 * Converts rem against the real root font size rather than an assumed 16.
 *
 * Both the gap and the collision padding go through this, so a user at a 150%
 * root font size gets proportionally more of each — the same rule the rest of
 * the layout follows (Requirement 13.4.1, 22.1).
 */
function remToPx(rem: number): number {
  const parsed = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );

  return rem * (Number.isFinite(parsed) && parsed > 0 ? parsed : 16);
}

/**
 * A hover/focus tooltip.
 *
 * **Rendered in a portal, positioned `fixed`.** An absolutely positioned
 * tooltip is clipped by any ancestor with `overflow` set, and `z-index` cannot
 * escape an overflow clip — so an earlier version was cut off almost everywhere
 * in the app: tree rows sit inside the sidebar's scroll container, card avatars
 * inside a board column's, and everything inside the shell's `overflow-hidden`.
 * It only looked correct in Storybook, which has no clipping ancestor.
 *
 * **It also avoids the viewport edges**, which the portal alone does not fix.
 * Escaping an overflow clip gets the tooltip painted; it does not stop it
 * running off the screen. A tree row one rem from the left edge, a breadcrumb
 * at the top of the window, an avatar on the rightmost board column — each
 * centred its tooltip on the trigger and let it overhang. `tooltipPlacement.ts`
 * flips and shifts it, following Radix's `avoidCollisions` and
 * `sticky: "partial"` (the primitive shadcn/ui wraps).
 *
 * The coordinates are one of the two documented inline-`style` exceptions, the
 * other being the bottom sheet's drag offset (Requirement 13.4). A viewport
 * position computed from `getBoundingClientRect` cannot be a utility class.
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
  /*
   * The bubble, by contrast, is only ever read inside a layout effect — after
   * commit — so a plain ref is right and state would cause an extra render.
   */
  const bubble = useRef<HTMLSpanElement | null>(null);

  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement | null>(null);

  const measure = useCallback(() => {
    const element = bubble.current;

    if (!trigger || !element) return;

    const size = element.getBoundingClientRect();

    /*
     * A zero-size box means `display: none`, which is the coarse-pointer case
     * (`hidden can-hover:block`) and also every jsdom test, since jsdom has no
     * layout. The inference is safe rather than lucky: the bubble carries
     * padding, so a rendered one is never 0×0 even with empty content.
     *
     * Returning leaves `placement` null, which keeps the bubble `invisible`.
     * Running the collision maths against a zero box would instead produce
     * coordinates that are confidently wrong.
     */
    if (size.width === 0 && size.height === 0) return;

    setPlacement(
      resolveTooltipPlacement(trigger.getBoundingClientRect(), size, side, {
        gap: remToPx(GAP_REM),
        padding: remToPx(COLLISION_PADDING_REM),
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    );
  }, [trigger, side]);

  const show = useCallback(() => {
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    setPlacement(null);
  }, []);

  /*
   * Measure after the bubble mounts and before the browser paints, so the
   * unplaced frame is never seen.
   *
   * This is a read-then-write cycle the previous version avoided by centring
   * with a CSS transform and never measuring itself — cheaper, and exactly why
   * it could not avoid the viewport edge: a tooltip that does not know its own
   * size cannot know it is about to overflow. One extra layout pass buys the
   * flip and the shift. It does not loop, because `measure` keeps a stable
   * identity across the render its own `setPlacement` causes, and because the
   * bubble's size does not depend on where it sits — `max-w-64` is the same
   * at every position, so one measurement stays valid.
   *
   * The same handler is attached to scroll and resize. A `fixed` tooltip does
   * not travel with its trigger, so without this a scroll would strand it, and
   * a window resize would leave a flip decision made against the old viewport.
   * `capture: true` matters: scroll does not bubble, so a window listener would
   * never see a nested scroll container without it.
   */
  useLayoutEffect(() => {
    if (!open) return;

    measure();

    window.addEventListener("scroll", measure, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  if (!isValidElement(children)) return children;

  return (
    <>
      {/*
        `inline-flex`, not `display: contents`. A `contents` element generates no
        box, so `getBoundingClientRect()` on it returns all zeros and the
        tooltip would anchor to the top-left of the viewport. This wrapper is
        the element being measured, so it has to be a real box.
      */}
      <span
        ref={setTrigger}
        className="inline-flex"
        onPointerEnter={show}
        onPointerLeave={hide}
      >
        {cloneElement(children, {
          "aria-describedby": open ? id : undefined,
          onFocus: show,
          onBlur: hide,
        })}
      </span>

      {open &&
        createPortal(
          <span
            id={id}
            ref={bubble}
            role="tooltip"
            /*
             * The side actually used, after any flip — the attribute Radix sets
             * for the same reason, so a direction-aware style reads where the
             * tooltip is rather than where it was asked to go.
             */
            data-side={placement?.side ?? side}
            /*
             * Viewport coordinates — the documented exception above. React
             * appends the unit, so there is no px literal in the source. The
             * pre-measure fallback is the origin; it is never painted, because
             * the bubble is `invisible` until a placement exists.
             */
            style={{ top: placement?.top ?? 0, left: placement?.left ?? 0 }}
            className={cn(
              // `max-w` with wrapping rather than `whitespace-nowrap`: a long
              // truncated name is exactly what a tooltip is for, and nowrap
              // would push it off-screen instead of wrapping.
              "pointer-events-none fixed z-50 hidden max-w-64 text-pretty",
              "rounded-md bg-ink-900 px-2 py-1 text-xs font-medium text-white shadow-popover",
              // `hidden` by default and shown only where a real pointer exists,
              // so touch never gets a tooltip even though focus fires on tap.
              "can-hover:block",
              /*
               * `invisible`, not `hidden`, for the frame before the placement
               * is known. `visibility: hidden` still generates a box, which is
               * what makes it measurable; `display: none` would report 0×0 and
               * the measurement would never resolve.
               */
              placement === null && "invisible",
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

/**
 * Tooltip placement geometry.
 *
 * Pure arithmetic over two rectangles and a viewport — no React, no DOM reads,
 * no `window`. The component measures and passes the numbers in, which is the
 * whole reason the collision behaviour is testable at all: jsdom has no layout,
 * so a test that rendered a tooltip could never assert where it landed.
 *
 * The behaviour mirrors Radix UI's tooltip — the primitive shadcn/ui wraps —
 * narrowed to what this app actually calls for:
 *
 * | Radix               | Here                                                  |
 * | ------------------- | ----------------------------------------------------- |
 * | `avoidCollisions`   | Flip to the opposite side when the preferred one has no room and the opposite does |
 * | `sticky: "partial"` | Shift along the **cross** axis to stay in view, never along the main axis |
 * | `collisionPadding`  | A margin held from every viewport edge                |
 * | `sideOffset`        | The gap between trigger and tooltip                   |
 *
 * Deliberately not mirrored: `align`/`alignOffset`, since every call site
 * centres; arrows, which this tooltip has never drawn; and `collisionBoundary`
 * beyond the viewport, because the tooltip is portalled to `document.body`
 * specifically to escape the scroll containers a boundary would describe.
 */

export type TooltipSide = "top" | "bottom" | "left" | "right";

/** A rectangle, as `getBoundingClientRect` reports it in viewport coordinates. */
export interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface PlacementOptions {
  /** Distance between the trigger and the tooltip — Radix's `sideOffset`. */
  readonly gap: number;
  /** Margin held from every viewport edge — Radix's `collisionPadding`. */
  readonly padding: number;
  readonly viewport: Size;
}

export interface TooltipPlacement {
  /**
   * The side actually used, which differs from the requested one after a flip.
   *
   * Exposed because the caller renders it as `data-side`, the same attribute
   * Radix sets — so a direction-aware style or animation reads where the
   * tooltip *is* rather than where it was asked to go.
   */
  readonly side: TooltipSide;
  /** Viewport coordinates of the tooltip's top-left corner. */
  readonly top: number;
  readonly left: number;
}

/**
 * The side a flip lands on.
 *
 * A `Record` rather than a `switch`: adding a side leaves a missing key here,
 * which is a compile error, and the mapping is enumerable by reading one
 * declaration (Requirement 21.15, 21.18).
 */
const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/**
 * The axis a tooltip may be shifted along for each side.
 *
 * The main axis is the one separating the tooltip from its trigger; the cross
 * axis runs parallel to the trigger's edge. Only the cross axis may move.
 */
const CROSS_AXIS: Record<TooltipSide, "x" | "y"> = {
  top: "x",
  bottom: "x",
  left: "y",
  right: "y",
};

/** Whether the tooltip fits between the trigger and that side's edge. */
function fitsOn(
  side: TooltipSide,
  anchor: Rect,
  size: Size,
  options: PlacementOptions,
): boolean {
  const { gap, padding, viewport } = options;

  const room: Record<TooltipSide, number> = {
    top: anchor.top - gap - padding,
    bottom: viewport.height - (anchor.top + anchor.height) - gap - padding,
    left: anchor.left - gap - padding,
    right: viewport.width - (anchor.left + anchor.width) - gap - padding,
  };

  const needed: Record<TooltipSide, number> = {
    top: size.height,
    bottom: size.height,
    left: size.width,
    right: size.width,
  };

  return room[side] >= needed[side];
}

/** The tooltip's top-left corner for a side, centred on the cross axis. */
function originFor(
  side: TooltipSide,
  anchor: Rect,
  size: Size,
  gap: number,
): { readonly top: number; readonly left: number } {
  const centredX = anchor.left + anchor.width / 2 - size.width / 2;
  const centredY = anchor.top + anchor.height / 2 - size.height / 2;

  const origin: Record<
    TooltipSide,
    { readonly top: number; readonly left: number }
  > = {
    top: { left: centredX, top: anchor.top - gap - size.height },
    bottom: { left: centredX, top: anchor.top + anchor.height + gap },
    left: { left: anchor.left - gap - size.width, top: centredY },
    right: { left: anchor.left + anchor.width + gap, top: centredY },
  };

  return origin[side];
}

/**
 * Clamps a coordinate into the available span.
 *
 * `Math.max(min, max)` on the upper bound is what makes a tooltip wider than
 * the viewport overflow to the *right* rather than to the left. Both are
 * wrong, but one of them hides the start of the sentence.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Where a tooltip should sit, given its trigger, its own size and the viewport.
 *
 * Two corrections, in this order:
 *
 * 1. **Flip.** If the preferred side has no room and the opposite does, use the
 *    opposite. If neither fits, keep the preference — flipping into a second
 *    overflow trades one clipped edge for another and moves the tooltip away
 *    from where the user is looking.
 * 2. **Shift**, cross-axis only. A tooltip on a trigger near the left edge
 *    slides right along that edge; one near the top of the sidebar slides down.
 *    Shifting the *main* axis would detach the tooltip from the thing it
 *    describes, which is why Radix's `sticky: "partial"` does the same.
 */
export function resolveTooltipPlacement(
  anchor: Rect,
  size: Size,
  preferred: TooltipSide,
  options: PlacementOptions,
): TooltipPlacement {
  const opposite = OPPOSITE[preferred];

  const side =
    fitsOn(preferred, anchor, size, options) ||
    !fitsOn(opposite, anchor, size, options)
      ? preferred
      : opposite;

  const origin = originFor(side, anchor, size, options.gap);
  const { padding, viewport } = options;

  return {
    side,
    left:
      CROSS_AXIS[side] === "x"
        ? clamp(origin.left, padding, viewport.width - padding - size.width)
        : origin.left,
    top:
      CROSS_AXIS[side] === "y"
        ? clamp(origin.top, padding, viewport.height - padding - size.height)
        : origin.top,
  };
}

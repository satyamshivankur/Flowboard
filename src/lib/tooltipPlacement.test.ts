import { describe, expect, it } from "vitest";

import {
  resolveTooltipPlacement,
  type PlacementOptions,
  type Rect,
  type Size,
} from "./tooltipPlacement";

/**
 * The collision arithmetic, tested where it can be tested.
 *
 * jsdom has no layout — every `getBoundingClientRect` returns zeros — so a
 * rendered tooltip can never be asserted to have landed anywhere. That is why
 * this geometry is a pure module taking two rectangles and a viewport: the
 * flip and the shift are checkable here, and the component's job reduces to
 * measuring and writing the numbers it is handed.
 *
 * The same split the board's drag arithmetic uses, and for the same reason.
 */

const VIEWPORT: Size = { width: 1000, height: 800 };

const OPTIONS: PlacementOptions = {
  gap: 6,
  padding: 8,
  viewport: VIEWPORT,
};

/** A 100×400 tooltip is wide and tall enough to collide on purpose. */
const BUBBLE: Size = { width: 100, height: 40 };

function anchor(overrides: Partial<Rect> = {}): Rect {
  return { top: 400, left: 500, width: 20, height: 20, ...overrides };
}

describe("preferred side, with room", () => {
  it("places above the trigger, centred, one gap away", () => {
    const placement = resolveTooltipPlacement(anchor(), BUBBLE, "top", OPTIONS);

    expect(placement.side).toBe("top");
    // 400 - 6 - 40
    expect(placement.top).toBe(354);
    // 500 + 10 - 50
    expect(placement.left).toBe(460);
  });

  it("places below, left and right from the same anchor", () => {
    const sides = (["bottom", "left", "right"] as const).map((side) =>
      resolveTooltipPlacement(anchor(), BUBBLE, side, OPTIONS),
    );

    expect(sides.map((placement) => placement.side)).toEqual([
      "bottom",
      "left",
      "right",
    ]);

    const [below, before, after] = sides;

    expect(below?.top).toBe(426); // 400 + 20 + 6
    expect(before?.left).toBe(394); // 500 - 6 - 100
    expect(after?.left).toBe(526); // 500 + 20 + 6
  });
});

/*
 * Radix's `avoidCollisions`. The case that matters in this app is a breadcrumb
 * or a board card near the top of the window: `side="top"` is the sensible
 * default everywhere, and at the top of the viewport it is the one place it
 * cannot be honoured.
 */
describe("flipping when the preferred side has no room", () => {
  it("flips top to bottom against the top edge", () => {
    const placement = resolveTooltipPlacement(
      anchor({ top: 10 }),
      BUBBLE,
      "top",
      OPTIONS,
    );

    expect(placement.side).toBe("bottom");
    expect(placement.top).toBe(36); // 10 + 20 + 6
  });

  it("flips bottom to top against the bottom edge", () => {
    const placement = resolveTooltipPlacement(
      anchor({ top: 770 }),
      BUBBLE,
      "bottom",
      OPTIONS,
    );

    expect(placement.side).toBe("top");
  });

  /* The sidebar's own case: a tree row's tooltip has nowhere to go but right. */
  it("flips left to right against the left edge", () => {
    const placement = resolveTooltipPlacement(
      anchor({ left: 4 }),
      BUBBLE,
      "left",
      OPTIONS,
    );

    expect(placement.side).toBe("right");
    expect(placement.left).toBe(30); // 4 + 20 + 6
  });

  it("flips right to left against the right edge", () => {
    const placement = resolveTooltipPlacement(
      anchor({ left: 960 }),
      BUBBLE,
      "right",
      OPTIONS,
    );

    expect(placement.side).toBe("left");
  });

  /*
   * Flipping into a second overflow trades one clipped edge for another and
   * moves the tooltip away from where the user is looking, so the preference
   * wins and the cross-axis shift limits the damage.
   */
  it("keeps the preferred side when neither fits", () => {
    const tall: Size = { width: 100, height: 700 };

    const placement = resolveTooltipPlacement(
      anchor({ top: 390 }),
      tall,
      "top",
      OPTIONS,
    );

    expect(placement.side).toBe("top");
  });
});

/*
 * Radix's `sticky: "partial"`. This is the half the flip cannot fix: a trigger
 * in a corner needs the tooltip to slide *along* the edge, not away from it.
 */
describe("shifting along the cross axis", () => {
  it("keeps a top tooltip inside the left edge", () => {
    const placement = resolveTooltipPlacement(
      anchor({ left: 2 }),
      BUBBLE,
      "top",
      OPTIONS,
    );

    expect(placement.side).toBe("top");
    // Centred would be -38; clamped to the collision padding instead.
    expect(placement.left).toBe(8);
  });

  it("keeps a top tooltip inside the right edge", () => {
    const placement = resolveTooltipPlacement(
      anchor({ left: 980 }),
      BUBBLE,
      "top",
      OPTIONS,
    );

    // 1000 - 8 - 100
    expect(placement.left).toBe(892);
  });

  it("keeps a side tooltip inside the top and bottom edges", () => {
    const high = resolveTooltipPlacement(
      anchor({ top: 2 }),
      BUBBLE,
      "right",
      OPTIONS,
    );
    const low = resolveTooltipPlacement(
      anchor({ top: 790 }),
      BUBBLE,
      "right",
      OPTIONS,
    );

    expect(high.top).toBe(8);
    expect(low.top).toBe(752); // 800 - 8 - 40
  });

  /*
   * The main axis is never shifted. Sliding it would put the tooltip somewhere
   * other than beside the thing it describes, which is worse than an overhang.
   */
  it("never shifts the main axis", () => {
    const placement = resolveTooltipPlacement(
      anchor({ top: 390 }),
      { width: 100, height: 700 },
      "top",
      OPTIONS,
    );

    // 390 - 6 - 700, left off-screen rather than slid down over the trigger.
    expect(placement.top).toBe(-316);
  });

  /*
   * Both bounds are wrong when the tooltip is wider than the viewport, so the
   * tie-break is which edge to lose. Overflowing right keeps the start of the
   * sentence on screen.
   */
  it("overflows right rather than left when wider than the viewport", () => {
    const placement = resolveTooltipPlacement(
      anchor(),
      { width: 1200, height: 40 },
      "top",
      OPTIONS,
    );

    expect(placement.left).toBe(8);
  });
});

/*
 * Both offsets are converted from rem by the component, so a larger root font
 * size feeds larger numbers in. Asserting they are honoured rather than
 * rounded or ignored is what keeps that conversion meaningful.
 */
describe("offsets", () => {
  it("honours the gap and the collision padding", () => {
    const placement = resolveTooltipPlacement(
      anchor({ left: 0 }),
      BUBBLE,
      "top",
      {
        gap: 24,
        padding: 32,
        viewport: VIEWPORT,
      },
    );

    expect(placement.top).toBe(336); // 400 - 24 - 40
    expect(placement.left).toBe(32);
  });

  it("counts the padding when deciding whether a side fits", () => {
    const anchorRect = anchor({ top: 50 });

    // 50 - 6 - 40 = 4px of slack, which clears a 2px padding and not a 32px one.
    expect(
      resolveTooltipPlacement(anchorRect, BUBBLE, "top", {
        ...OPTIONS,
        padding: 2,
      }).side,
    ).toBe("top");

    expect(
      resolveTooltipPlacement(anchorRect, BUBBLE, "top", {
        ...OPTIONS,
        padding: 32,
      }).side,
    ).toBe("bottom");
  });
});

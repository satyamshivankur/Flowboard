import { type Locator, type Page } from "@playwright/test";

/**
 * Touch gestures, dispatched through CDP.
 *
 * `page.touchscreen` only offers `tap()`, and every behaviour worth testing
 * here is about *movement over time*: the board's `PointerSensor` resolves its
 * activation constraint from `event.pointerType`, giving a fine pointer an 8px
 * distance threshold and a touch a 200ms press with 10px of tolerance. Telling
 * "scroll" apart from "drag" therefore needs real touch streams, which means
 * `Input.dispatchTouchEvent`.
 *
 * Chromium-only, which is fine: the mobile project is a Pixel 7 descriptor and
 * `defaultBrowserType` on it is chromium.
 */

/** The centre of a locator, in page coordinates. */
export async function centreOf(
  locator: Locator,
): Promise<{ readonly x: number; readonly y: number }> {
  const box = (await locator.boundingBox())!;

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export interface SwipeOptions {
  /**
   * How long to hold still before moving, in milliseconds.
   *
   * This is the one place a fixed wait is the *subject* rather than a smell:
   * the sensor's `Delay({ value: 200, tolerance: 10 })` is a time threshold, so
   * a spec that proves "only a long press drags" has to straddle it. Pass well
   * under 200 for a scroll, well over for a drag.
   */
  readonly holdMs?: number;
  /** Intermediate move events. Too few and dnd-kit sees no travel at all. */
  readonly steps?: number;
}

/**
 * A touch swipe from one point to another.
 *
 * The shape mirrors `drag.ts`'s pointer helper: hold, traverse in steps, then
 * one more event at rest before release, so the final `onDragOver` has landed
 * before `onDragEnd` reads the plan.
 */
export async function touchSwipe(
  page: Page,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  options: SwipeOptions = {},
): Promise<void> {
  const { holdMs = 0, steps = 12 } = options;
  const client = await page.context().newCDPSession(page);

  try {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from.x, y: from.y }],
    });

    if (holdMs > 0) await page.waitForTimeout(holdMs);

    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;

      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: from.x + (to.x - from.x) * ratio,
            y: from.y + (to.y - from.y) * ratio,
          },
        ],
      });
    }

    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: to.x, y: to.y }],
    });

    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await client.detach();
  }
}

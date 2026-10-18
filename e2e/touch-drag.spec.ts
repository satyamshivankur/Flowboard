import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { columnOrder } from "./helpers/drag";
import { column, taskCard } from "./helpers/nav";
import { centreOf, touchSwipe } from "./helpers/touch";

/**
 * Requirement 20.8, on a touchscreen — the oldest open item in the plan
 * (tasks 14.7.1 and 26.10), carried for two phases as "needs a real device".
 *
 * The claim under test is a *discrimination*, not a feature: one
 * `PointerSensor` serves mouse, pen and touch, and resolves its activation
 * constraint from `event.pointerType` — 8px of travel for a fine pointer, a
 * 200ms press with 10px tolerance for a touch. Without the delay the mobile
 * board is unusable, because every swipe meant as a scroll starts a drag
 * instead. So what matters is that the *same* gesture does different things
 * either side of 200ms.
 *
 * Three cases, and the first two are the ones that would catch a regression:
 * a quick swipe must move the board and leave the cards alone, and a held
 * press must pick a card up. A test that only proved dragging works would pass
 * with the delay removed entirely.
 */

test.describe("touch gestures on the board", () => {
  test.skip(
    ({ isMobile }) => isMobile !== true,
    "touch activation only applies where the pointer is coarse",
  );

  /** The board's horizontal scroll offset, which paging moves. */
  async function scrollLeft(page: Page): Promise<number> {
    return page
      .locator("div.snap-x")
      .first()
      .evaluate((element) => element.scrollLeft);
  }

  test("a quick horizontal swipe pages the board and moves no card", async ({
    page,
  }) => {
    const before = await columnOrder(page, "To do");

    expect(before.length).toBeGreaterThan(1);
    expect(await scrollLeft(page)).toBe(0);

    const card = taskCard(column(page, "To do"), before[0] ?? "");
    const from = await centreOf(card);

    /* Well under the 200ms threshold: this is a scroll, not a pick-up. */
    await touchSwipe(
      page,
      from,
      { x: from.x - 260, y: from.y },
      {
        holdMs: 30,
      },
    );

    await expect
      .poll(async () => scrollLeft(page), {
        message: "the board should have paged to the next column",
      })
      .toBeGreaterThan(0);

    /* The gesture moved the viewport, not the data. */
    expect(await columnOrder(page, "To do")).toEqual(before);
  });

  test("a quick vertical swipe scrolls a column and moves no card", async ({
    page,
  }) => {
    const before = await columnOrder(page, "To do");
    const card = taskCard(column(page, "To do"), before[0] ?? "");
    const from = await centreOf(card);

    await touchSwipe(
      page,
      from,
      { x: from.x, y: from.y - 200 },
      {
        holdMs: 30,
      },
    );

    /*
     * Asserting the *absence* of a drag rather than a scroll offset: the seeded
     * column may not overflow at this viewport, in which case there is nothing
     * to scroll and a zero offset would be a false failure. What must hold
     * either way is that no card moved and no overlay was ever raised.
     */
    expect(await columnOrder(page, "To do")).toEqual(before);
    await expect(page.locator("[data-dnd-overlay]")).toBeHidden();
  });

  test("a long press picks a card up and moves it", async ({ page }) => {
    const before = await columnOrder(page, "To do");
    const [first, second] = before;

    expect(second).toBeDefined();

    const card = taskCard(column(page, "To do"), first ?? "");
    const target = taskCard(column(page, "To do"), second ?? "");

    const from = await centreOf(card);
    const to = await centreOf(target);

    /* Past the 200ms press, so the same travel now drags instead of scrolls. */
    await touchSwipe(page, from, { x: to.x, y: to.y + 8 }, { holdMs: 400 });

    await expect
      .poll(async () => columnOrder(page, "To do"), {
        message: "a held press should have reordered the column",
      })
      .not.toEqual(before);

    const after = await columnOrder(page, "To do");

    expect(after).toHaveLength(before.length);
    expect(after[0]).toBe(second);
    expect(after[1]).toBe(first);
  });
});

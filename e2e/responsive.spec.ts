import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { column, openTree } from "./helpers/nav";

/**
 * The page itself never scrolls sideways.
 *
 * Requirement 20.2 puts the supported range at `20rem` (320px) upward and says
 * the layout must be usable "without horizontal page scrolling at every width
 * in that range"; 16.9 says the same about the app chrome. This asserts it as
 * a measurement rather than as a visual impression.
 *
 * **Why this cannot be a jsdom test.** It needs layout — `scrollWidth`,
 * `clientWidth` and a real containing-block resolution — and jsdom reports
 * every rect as zero. The violation it was written for was invisible to 666
 * green unit tests for exactly that reason.
 *
 * The violation, for the record, because the cause is not where anyone would
 * look: Tailwind's `sr-only` is `position: absolute` with no offsets, so with
 * no positioned ancestor its containing block is the **initial** containing
 * block — and an absolutely positioned element is not clipped by an ancestor's
 * `overflow` unless that ancestor *is* its containing block. The visually
 * hidden labels inside cards in the board's horizontally scrolled columns
 * therefore escaped the shell's `overflow-hidden` and extended the document's
 * scroll area. At 320px the entire chrome could be scrolled out of view,
 * leaving a blank surface. `AppShell` is now `relative`, which makes it the
 * containing block and clips them.
 *
 * Asserted at several widths rather than one, because the cause scales with
 * the board's content width and the symptom only appears once the content is
 * wider than the viewport.
 */

/** Widths from Requirement 20.2's range, plus the breakpoint boundaries. */
const WIDTHS = [320, 360, 414, 640, 768, 1024, 1280, 1920] as const;

/** Whether the document can be scrolled on the horizontal axis at all. */
async function horizontalPageScroll(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const before = de.scrollLeft;

    /*
     * Measured by attempting the scroll rather than by comparing
     * `scrollWidth` to `clientWidth`. A sub-pixel difference from a fractional
     * device ratio shows up in those numbers and is not a scroll; what matters
     * is whether the viewport can actually be moved off the layout.
     */
    de.scrollLeft = 1000;

    const landed = de.scrollLeft;

    de.scrollLeft = before;

    return {
      maxScrollLeft: landed,
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
    };
  });
}

for (const width of WIDTHS) {
  test(`the page does not scroll sideways at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });

    // The board has to be on screen for its columns to contribute any width.
    await expect(page.getByRole("main")).toBeVisible();
    await expect(column(page, "To do")).toBeVisible();

    const { maxScrollLeft, scrollWidth, clientWidth } =
      await horizontalPageScroll(page);

    expect(
      maxScrollLeft,
      `the chrome scrolled ${String(maxScrollLeft)}px out of view at ${String(width)}px`,
    ).toBe(0);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

/*
 * The board's own horizontal scroll is the point of the phone layout, so the
 * assertion above must not be satisfiable by breaking it. One column paging at
 * a time is Requirement 20.5.
 */
test("the board still scrolls horizontally inside its own track", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });

  const track = page.locator(".overflow-x-auto").first();

  await expect(track).toBeVisible();

  const scrollable = await track.evaluate(
    (el) => el.scrollWidth > el.clientWidth,
  );

  expect(scrollable, "the board track should still page between columns").toBe(
    true,
  );
});

/*
 * The column is capped to the viewport rather than a flat `22rem`, which is
 * what `design.md` specified all along — a 22rem column at 320px put a third
 * of every card off screen.
 */
test("a board column fits inside a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });

  const box = await column(page, "To do").boundingBox();

  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeLessThanOrEqual(320);
});

/*
 * Opening the two overlays is what would reintroduce the problem from a
 * different direction, since both render outside the shell's subtree.
 */
test("no sideways scroll with the navigation sheet open", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });

  await openTree(page);

  const { maxScrollLeft } = await horizontalPageScroll(page);

  expect(maxScrollLeft).toBe(0);
});

test("no sideways scroll with the task drawer open", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });

  const card = column(page, "To do")
    .locator('[aria-roledescription="draggable"]')
    .first();

  await expect(card).toBeVisible();

  /*
   * Focus and Enter rather than a click: a click on a card lands on the
   * title's click-to-edit field, which is correct behaviour (15.4) and not
   * what this test wants.
   */
  await card.focus();
  await card.press("Enter");

  await expect(page.getByRole("dialog")).toBeAttached();

  const { maxScrollLeft } = await horizontalPageScroll(page);

  expect(maxScrollLeft).toBe(0);
});

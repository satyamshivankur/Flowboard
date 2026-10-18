import { expect, test } from "./fixtures";
import { column } from "./helpers/nav";

/**
 * Focus rings survive the scroll containers they sit in.
 *
 * The reported bug: a card's focus outline was shaved off on every side inside
 * a kanban column. The cause is not a styling mistake in either component —
 * it is the relationship between them. A card's indicator is
 * `outline-2 outline-offset-2`, so it paints 4px *outside* the card's box,
 * and the column's card list scrolls, which clips to its padding box. At the
 * `p-0.5` it had, 2px of ring went under the clip on all four sides.
 *
 * **This cannot be tested in jsdom.** Resolving it needs `outline-width`,
 * `outline-offset` and `padding` as computed values plus real geometry, and
 * jsdom loads no CSS and lays nothing out — every rect is zero. So it lives
 * here, with the drag specs, for the same reason they do.
 *
 * Asserted as an invariant rather than against the literal `4px`: the point is
 * that a scroll container's clearance is at least its focusables' ring reach,
 * so bumping either value on either side keeps this test meaningful instead of
 * needing it edited.
 */

test("a focused card's ring is not clipped by its column", async ({ page }) => {
  const card = column(page, "To do")
    .locator('[aria-roledescription="draggable"]')
    .first();

  await expect(card).toBeVisible();

  const geometry = await card.evaluate((element) => {
    element.focus();

    const style = getComputedStyle(element);
    const reach =
      parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);

    const area = element.closest<HTMLElement>(".overflow-y-auto");

    if (area === null) throw new Error("Card is not inside a scroll area");

    const card = element.getBoundingClientRect();
    const clip = area.getBoundingClientRect();

    return {
      reach,
      left: card.left - clip.left,
      right: clip.right - card.right,
      top: card.top - clip.top,
    };
  });

  /*
   * The ring reaches outside the card on every side, so every side of the
   * clip needs that much clearance. Checked individually rather than as one
   * boolean, so a failure names which edge is short.
   */
  expect(geometry.reach).toBeGreaterThan(0);
  expect(geometry.left).toBeGreaterThanOrEqual(geometry.reach);
  expect(geometry.right).toBeGreaterThanOrEqual(geometry.reach);
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.reach);
});

/*
 * `overflow-y-auto` clips horizontally too, which is the part that makes this
 * surprising: CSS computes the `visible` axis to `auto` when the other axis is
 * not `visible`. Recorded as an assertion because the fix only makes sense
 * once that is true — otherwise the left and right clearance would not matter.
 */
test("a column's card list clips on both axes, not just the one it declares", async ({
  page,
}) => {
  const area = column(page, "To do").locator(".overflow-y-auto").first();

  await expect(area).toBeVisible();

  const overflow = await area.evaluate((element) => {
    const style = getComputedStyle(element);

    return { x: style.overflowX, y: style.overflowY };
  });

  expect(overflow.y).toBe("auto");
  expect(overflow.x).not.toBe("visible");
});

/**
 * The other half of the fix.
 *
 * Padding alone covers a card that is already in view. Tabbing down a column
 * long enough to scroll makes the browser bring the next card into view
 * itself, and it aligns flush to the clip edge unless `scroll-padding` says
 * otherwise — so the ring is clipped again at the one moment it is actually
 * being used.
 *
 * The viewport is squeezed rather than the fixtures padded, because what this
 * needs is a column that overflows, and the seeded Backlog does not at a
 * normal height.
 */
test("a card scrolled into view keeps its ring clear of the edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 420 });

  const area = column(page, "To do").locator(".overflow-y-auto").first();

  await expect(area).toBeVisible();

  const overflows = await area.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  );

  expect(overflows, "the column must overflow for this to mean anything").toBe(
    true,
  );

  const last = column(page, "To do")
    .locator('[aria-roledescription="draggable"]')
    .last();

  const geometry = await last.evaluate((element) => {
    element.focus();

    const style = getComputedStyle(element);
    const reach =
      parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);

    const area = element.closest<HTMLElement>(".overflow-y-auto");

    if (area === null) throw new Error("Card is not inside a scroll area");

    const card = element.getBoundingClientRect();
    const clip = area.getBoundingClientRect();

    return { reach, bottom: clip.bottom - card.bottom };
  });

  expect(geometry.bottom).toBeGreaterThanOrEqual(geometry.reach);
});

/**
 * Every other scrolling region, swept in one pass.
 *
 * The column was the only one short, and that is worth holding rather than
 * rediscovering: the sidebar has `px-2 py-2` and the board's horizontal
 * scroller `p-3`, both comfortably clear, and it is easy to tighten one later
 * for spacing reasons without connecting it to a focus ring.
 */
test("every scrolling region clears the rings of the controls inside it", async ({
  page,
}) => {
  const short = await page.evaluate(() => {
    /** What a focused element paints outside its own border box, in px. */
    function ringReach(element: HTMLElement): number {
      element.focus();

      const style = getComputedStyle(element);

      return parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
    }

    const problems: {
      area: string;
      control: string;
      reach: number;
      padding: number;
    }[] = [];

    for (const area of document.querySelectorAll<HTMLElement>(
      ".overflow-y-auto, .overflow-x-auto",
    )) {
      const style = getComputedStyle(area);
      const padding = Math.min(
        parseFloat(style.paddingTop),
        parseFloat(style.paddingBottom),
        parseFloat(style.paddingLeft),
        parseFloat(style.paddingRight),
      );

      for (const control of area.querySelectorAll<HTMLElement>(
        'button, input, [tabindex="0"]',
      )) {
        const needed = ringReach(control);

        if (needed > padding) {
          problems.push({
            area: area.className.slice(0, 48),
            control: control.getAttribute("aria-label") ?? control.tagName,
            reach: needed,
            padding,
          });
        }
      }
    }

    return problems;
  });

  expect(short).toEqual([]);
});

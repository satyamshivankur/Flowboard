import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { column, taskCard } from "./helpers/nav";

/**
 * The task drawer's body scrolls when its content overflows — in both forms.
 *
 * **Why this cannot be a jsdom test.** It needs real layout: a percentage
 * height resolved against a flex item, a flex container capped by
 * `max-height`, and `scrollHeight` versus `clientHeight`. jsdom loads no CSS
 * and reports every rect as zero, so the bug this was written for was
 * invisible to the whole unit suite. Same reason `focus-ring.spec.ts` and
 * `responsive.spec.ts` live here.
 *
 * **The bug, because the cause is not where anyone would look.** `ScrollShadow`
 * sized its scroller with `h-full` — `height: 100%`. A percentage height
 * resolves against the containing block, and when that block's height is
 * *indefinite* the percentage is dropped and the element falls back to sizing
 * itself to its content. A scroll container sized to its own content has
 * `scrollHeight === clientHeight`, so there is nothing to scroll: the overflow
 * is clipped by an ancestor and the content past the fold is unreachable.
 *
 * Whether that chain was definite depended on the drawer's form, which is why
 * only the phone was affected. The desktop panel is `md:inset-y-0` — top and
 * bottom both anchored, so its height is definite and the percentage resolved.
 * The mobile sheet is `bottom-0` with `max-h-[92dvh]` and no `top`, so its
 * height is auto-capped rather than definite. Measured at 360x560 before the
 * fix: a 365px slot holding a 666px scroller, 301px of it behind the footer,
 * `scrollTop` pinned at 0.
 *
 * The scroller is now sized by the flex algorithm (`flex-1 min-h-0`), which
 * resolves against the parent's *used* height and has no percentage to drop.
 *
 * Both assertions below are **measured relationships**, never literals, so
 * changing a viewport or the seed content keeps them meaningful instead of
 * needing an edit.
 */

/**
 * A task with subtasks, so the drawer body is tall enough to overflow.
 *
 * It is seeded onto Backlog's `st-bk-active` status, hence the "In progress"
 * column rather than "To do".
 */
const TALL_TASK = "Rework the task detail layout";
const TALL_TASK_COLUMN = "In progress";

/**
 * Opens the drawer by keyboard rather than by clicking the card.
 *
 * A click on a card body lands on the title's click-to-edit field, which is
 * correct behaviour (Requirement 15.4) and not what this wants.
 */
async function openDrawer(page: Page) {
  const card = taskCard(column(page, TALL_TASK_COLUMN), TALL_TASK);

  await expect(card).toBeVisible();
  await card.focus();
  await card.press("Enter");

  await expect(page.getByRole("dialog", { name: TALL_TASK })).toBeAttached();
}

interface ScrollGeometry {
  readonly clientHeight: number;
  readonly scrollHeight: number;
  readonly overflow: number;
  readonly maxScrollTopReached: number;
  /** How far the scroller's bottom edge sits past the slot it was given. */
  readonly overhangPastSlot: number;
  /** How far it sits past the top of the footer that would cover it. */
  readonly overlapsFooter: number;
}

/**
 * Measures the drawer's scroll region, and tries to scroll it.
 *
 * Scrollability is asserted by *attempting* the scroll rather than by trusting
 * `scrollHeight`, for the same reason `responsive.spec.ts` attempts its own:
 * the numbers can disagree with what the element will actually do.
 */
async function drawerScroll(page: Page): Promise<ScrollGeometry> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(
      '[id^="headlessui-dialog-panel"]',
    );

    if (!panel) throw new Error("the drawer panel is not mounted");

    const scroller = [...panel.querySelectorAll<HTMLElement>("*")].find((el) =>
      ["auto", "scroll"].includes(getComputedStyle(el).overflowY),
    );

    if (!scroller) throw new Error("the drawer has no scroll container");

    const slot = scroller.parentElement;
    const footer = panel.querySelector("footer");

    if (!slot || !footer) throw new Error("unexpected drawer structure");

    const before = scroller.scrollTop;

    scroller.scrollTop = 100_000;

    const maxScrollTopReached = Math.round(scroller.scrollTop);

    scroller.scrollTop = before;

    const scrollerRect = scroller.getBoundingClientRect();

    return {
      clientHeight: scroller.clientHeight,
      scrollHeight: scroller.scrollHeight,
      overflow: scroller.scrollHeight - scroller.clientHeight,
      maxScrollTopReached,
      overhangPastSlot: Math.round(
        scrollerRect.bottom - slot.getBoundingClientRect().bottom,
      ),
      overlapsFooter: Math.round(
        scrollerRect.bottom - footer.getBoundingClientRect().top,
      ),
    };
  });
}

/*
 * A short viewport, so the seed content is guaranteed to overflow rather than
 * the test depending on how tall one task happens to render. 360x560 is inside
 * Requirement 20.2's supported range and is the size the original fault was
 * measured at.
 */
test("the bottom sheet scrolls its overflowing body", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 560 });

  await openDrawer(page);

  const geometry = await drawerScroll(page);

  /*
   * The precondition. If this fails the viewport or the seed changed and the
   * assertions below would pass vacuously — which is the way a regression test
   * stops testing anything without ever going red.
   */
  expect(
    geometry.overflow,
    "the drawer body should overflow at this viewport, or the test proves nothing",
  ).toBeGreaterThan(0);

  /* The bug: overflow that exists and cannot be reached. */
  expect(
    geometry.maxScrollTopReached,
    "the drawer body did not scroll to the end of its content",
  ).toBe(geometry.overflow);
});

test("the desktop panel scrolls its overflowing body", async ({ page }) => {
  /*
   * Wide enough for the side-panel form, short enough to force overflow in it.
   * The panel form was never broken, so this is the guard against fixing the
   * sheet by breaking the panel.
   */
  await page.setViewportSize({ width: 1280, height: 420 });

  await openDrawer(page);

  const geometry = await drawerScroll(page);

  expect(geometry.overflow).toBeGreaterThan(0);
  expect(geometry.maxScrollTopReached).toBe(geometry.overflow);
});

/*
 * The other half of the same fault, and the half a user actually sees. A
 * content-sized scroller does not just refuse to scroll — it grows past the
 * slot it was given and the footer paints over the difference. So "it scrolls"
 * and "nothing is hidden" are two assertions, not one.
 */
test("the sheet's body stays inside its slot, under the footer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 560 });

  await openDrawer(page);

  const geometry = await drawerScroll(page);

  expect(
    geometry.overhangPastSlot,
    "the drawer body overhangs the space the panel gave it",
  ).toBeLessThanOrEqual(0);
  expect(
    geometry.overlapsFooter,
    "the drawer body extends under its own footer, hiding content",
  ).toBeLessThanOrEqual(0);

  /* And the footer is still reachable, which is what that overlap cost. */
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toBeVisible();
});

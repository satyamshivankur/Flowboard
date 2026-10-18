import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { columnOrder, dragTo } from "./helpers/drag";
import { breadcrumb, column, taskCard, toast } from "./helpers/nav";

/**
 * Optimistic rollback, after a real drag.
 *
 * `rollback.test.ts` already proves the store restores the exact pre-drag
 * domain — including fractional `position` values rather than just relative
 * order — and `views/rollback.test.tsx` already drives the dev panel end to
 * end. Both reach the mutation through the "Move down" menu item, because a
 * drag cannot be performed in jsdom.
 *
 * This is the same promise through the gesture it was written for: the card
 * lands under the cursor, the transport refuses, and the board puts it back.
 */

const FIRST = "Define onboarding checklist for new workspaces";
const SECOND = "Audit empty states across the product";
const THIRD = "Draft the Q3 roadmap outline";
const ACTIVE_FIRST = "Rework the task detail layout";
const ACTIVE_SECOND = "Replace ad-hoc spacing with the shared scale";

/** Arms the one-shot transport failure through the dev panel. */
async function armFailure(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Simulation settings" }).click();
  await page.getByRole("menuitem", { name: "Fail next operation" }).click();
  await expect(toast(page, "Armed")).toBeVisible();
}

/** Drags the last To-do card onto the first In-progress card. */
async function dragAcross(page: Page): Promise<void> {
  await dragTo(
    page,
    taskCard(column(page, "To do"), THIRD),
    taskCard(column(page, "In progress"), ACTIVE_FIRST),
  );
}

/*
 * The dev panel is `hidden lg:inline-flex` and is not among the items the
 * phone's overflow menu carries, so arming a failure is desktop-only. Rollback
 * itself is viewport-independent and already covered in jsdom.
 */
test.skip(
  ({ isMobile }) => isMobile === true,
  "The dev panel is only rendered from lg upwards.",
);

test("a refused drag puts the card back and offers a retry", async ({
  page,
}) => {
  await expect(breadcrumb(page)).toContainText("Backlog");

  const before = await columnOrder(page, "To do");

  expect(before).toEqual([FIRST, SECOND, THIRD]);

  await armFailure(page);
  await dragAcross(page);

  /*
   * A move is the app's only optimistic mutation, so the card is briefly in
   * the wrong column on purpose. What matters is where it ends up.
   */
  await expect(toast(page, "Connection problem")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  await expect.poll(() => columnOrder(page, "To do")).toEqual(before);
  expect(await columnOrder(page, "In progress")).toEqual([
    ACTIVE_FIRST,
    ACTIVE_SECOND,
  ]);
});

test("a refused drag leaves nothing behind in storage", async ({ page }) => {
  await armFailure(page);
  await dragAcross(page);

  await expect(toast(page, "Connection problem")).toBeVisible();

  /*
   * `autoPersist` writes on the optimistic apply, so the failed order reaches
   * localStorage before the transport answers. The rollback has to write again
   * to undo it — and only a reload can show whether it did.
   */
  await page.reload();

  await expect
    .poll(() => columnOrder(page, "To do"))
    .toEqual([FIRST, SECOND, THIRD]);
});

test("retrying a refused drag succeeds", async ({ page }) => {
  await armFailure(page);
  await dragAcross(page);

  await page.getByRole("button", { name: "Try again" }).click();

  /* `failNext` is one-shot, so the second attempt goes through. */
  await expect.poll(() => columnOrder(page, "In progress")).toContain(THIRD);
  expect(await columnOrder(page, "To do")).toEqual([FIRST, SECOND]);
});

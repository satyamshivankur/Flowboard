import { SEED_IDS } from "@/model/seed";

import { expect, test } from "./fixtures";
import {
  breadcrumb,
  column,
  openTree,
  taskCard,
  treeItem,
} from "./helpers/nav";
import { seedState } from "./helpers/seed";

/**
 * The real storage medium, across a real reload.
 *
 * `persistence.test.ts` already proves the store is not coupled to
 * localStorage by running it on `memoryAdapter`. What that cannot reach is the
 * adapter itself: the key, the payload shape, and whether a change written by
 * `autoPersist` is still there after the page is thrown away and rebuilt.
 */

test("a task created in the board survives a reload", async ({ page }) => {
  const title = "Task written by the e2e suite";

  await expect(breadcrumb(page)).toContainText("Backlog");

  await page.getByRole("button", { name: "Add task to To do" }).click();
  await page.getByRole("textbox", { name: "New task in To do" }).fill(title);
  await page.keyboard.press("Enter");

  await expect(taskCard(column(page, "To do"), title)).toBeVisible();

  /*
   * No explicit wait for the write: `autoPersist` saves off the store
   * subscription, and the card only renders once the mutation is applied.
   */
  await page.reload();

  await expect(taskCard(column(page, "To do"), title)).toBeVisible();
});

test("an injected state replaces the seed", async ({ page }) => {
  const renamed = "Renamed backlog";

  await seedState(page, (state) => ({
    ...state,
    containers: {
      ...state.containers,
      [SEED_IDS.lists.backlog]: {
        ...state.containers[SEED_IDS.lists.backlog]!,
        name: renamed,
      },
    },
  }));

  /* The fixture already navigated; an init script needs a fresh navigation. */
  await page.reload();

  const tree = await openTree(page);

  /*
   * Asserted on the injected name specifically, not merely on "the app
   * rendered": a payload the Model rejects is dropped and the seed shown in
   * its place, which looks identical to success from any weaker assertion.
   */
  await expect(treeItem(tree, renamed)).toBeVisible();
  await expect(treeItem(tree, "Sprint 14")).toBeVisible();
});

import { expect, test } from "./fixtures";
import { breadcrumb, column, openTree, treeItem } from "./helpers/nav";

/**
 * The harness itself, under test.
 *
 * If this file is red, nothing downstream is worth reading: it proves the
 * production build serves, the app boots against an empty localStorage, the
 * seed lands, and the clock is pinned.
 */

test("boots and renders the seeded workspace", async ({ page }) => {
  await expect(page.getByRole("main")).toBeVisible();

  const tree = await openTree(page);

  await expect(tree).toBeVisible();
  /* The tree's top level is the spaces; the workspace row itself is implied. */
  await expect(treeItem(tree, "Engineering")).toBeVisible();
  await expect(treeItem(tree, "Marketing")).toBeVisible();
});

test("auto-selects the first visible list and renders its board", async ({
  page,
}) => {
  /*
   * AppShell opens `selected.firstListId` once hydration settles. For Alice —
   * the default user, being the first admin membership — tree order is
   * Acme > Engineering > Q2 Launch > Backlog.
   */
  await expect(breadcrumb(page)).toContainText("Backlog");

  /* Backlog carries the DEFAULT_STATUS_TEMPLATE set, one column per category. */
  await expect(column(page, "To do")).toBeVisible();
  await expect(column(page, "In progress")).toBeVisible();
  await expect(column(page, "Done")).toBeVisible();
});

test("loads without console errors or page errors", async ({ page }) => {
  const problems: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => {
    problems.push(error.message);
  });

  /*
   * The fixture already navigated, so re-load with the listeners attached.
   * Waiting on a column rather than a load event: the board renders after
   * hydration, which is where a crash would surface.
   */
  await page.reload();
  await expect(column(page, "To do")).toBeVisible();

  expect(problems).toEqual([]);
});

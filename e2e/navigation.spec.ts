import { expect, test } from "./fixtures";
import {
  breadcrumb,
  column,
  expand,
  openTree,
  rowButton,
  selectList,
  setView,
  treeItem,
} from "./helpers/nav";

/**
 * Navigation is click-only by design: NavigationContext holds the selection in
 * memory and the app has no router, so there is nothing to deep-link to. Every
 * spec here reaches its target the way a user would.
 */

test("selecting a list swaps the board to that list's own statuses", async ({
  page,
}) => {
  /* "In review" is spliced into Sprint 14 alone, so it proves the swap. */
  await expect(column(page, "In review")).toBeHidden();

  await selectList(page, "Sprint 14");

  await expect(column(page, "In review")).toBeVisible();
  await expect(breadcrumb(page)).toContainText("Sprint 14");
});

test("selection is reflected on the tree row", async ({ page }) => {
  await selectList(page, "Sprint 14");

  /* Re-opened deliberately: selecting closes the drawer on a phone. */
  const tree = await openTree(page);

  await expect(treeItem(tree, "Sprint 14")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(treeItem(tree, "Backlog")).toHaveAttribute(
    "aria-selected",
    "false",
  );
});

test("a collapsed folder expands to reveal its lists", async ({ page }) => {
  const tree = await openTree(page);

  /*
   * Platform starts collapsed — AppShell only auto-expands the path to the
   * selection, which is Backlog under Q2 Launch. Every tree assertion in this
   * test runs before the selection click, which on mobile unmounts the tree.
   */
  await expect(treeItem(tree, "Platform")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(treeItem(tree, "Infra")).toBeHidden();

  await expand(tree, "Platform");

  await expect(treeItem(tree, "Platform")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(treeItem(tree, "Infra")).toBeVisible();

  await rowButton(tree, "Infra").click();

  await expect(breadcrumb(page)).toContainText("Infra");
});

test("switching view keeps the selected list", async ({ page }) => {
  await selectList(page, "Sprint 14");

  await setView(page, "list");

  await expect(breadcrumb(page)).toContainText("Sprint 14");
  /* The board's columns are gone once the list view takes over. */
  await expect(column(page, "In review")).toBeHidden();
});

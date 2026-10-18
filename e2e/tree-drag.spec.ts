import { expect, test } from "./fixtures";
import { dragTo } from "./helpers/drag";
import { openTree, rowButton, toast, treeRows } from "./helpers/nav";

/**
 * Dragging in the sidebar tree.
 *
 * This had no coverage in any layer. `dragDrop.test.ts` is the board's, and
 * there is no `SidebarTree.test.tsx` — so none of `handleDragEnd`'s three
 * resolution branches, nor its refusal, were asserted anywhere. It is the same
 * situation the board was in when two bugs shipped past a green suite.
 *
 * Unlike a task move, a container move is not optimistic: it awaits the
 * transport before applying, so every assertion here polls.
 */

/* The seeded tree with Backlog selected, which is where the app opens. */
const SEEDED = [
  "1:Engineering",
  "2:Q2 Launch",
  "3:Backlog",
  "3:Sprint 14",
  "2:Platform",
  "1:Marketing",
];

/* The tree is a static aside only from `lg`; below that it is a drawer. */
test.skip(
  ({ isMobile }) => isMobile === true,
  "Pointer drag is a desktop gesture; the drawer is covered in drawer.spec.ts.",
);

test("reorders two sibling lists", async ({ page }) => {
  expect(await treeRows(page)).toEqual(SEEDED);

  const tree = await openTree(page);

  /*
   * List onto list: a list cannot contain a list, and the two share a parent,
   * so this resolves as a reorder to the target's sibling index rather than a
   * reparent.
   */
  await dragTo(page, rowButton(tree, "Sprint 14"), rowButton(tree, "Backlog"));

  await expect
    .poll(() => treeRows(page))
    .toEqual([
      "1:Engineering",
      "2:Q2 Launch",
      "3:Sprint 14",
      "3:Backlog",
      "2:Platform",
      "1:Marketing",
    ]);
});

test("moves a list into another folder", async ({ page }) => {
  const tree = await openTree(page);

  /* A folder accepts a list, so this is a reparent, not a reorder. */
  await dragTo(page, rowButton(tree, "Backlog"), rowButton(tree, "Platform"));

  await expect(toast(page, 'Moved "Backlog" into "Platform"')).toBeVisible();

  /*
   * Platform was collapsed. It opens on its own because Backlog is still the
   * selected list and AppShell expands the path to the selection — so this
   * also covers the shell keeping up with a move underneath it.
   */
  await expect
    .poll(() => treeRows(page))
    .toEqual([
      "1:Engineering",
      "2:Q2 Launch",
      "3:Sprint 14",
      "2:Platform",
      "3:Infra",
      "3:Backlog",
      "1:Marketing",
    ]);
});

test("refuses a drop the hierarchy does not allow", async ({ page }) => {
  const tree = await openTree(page);

  /*
   * A space onto a list. Neither the target nor the target's parent can hold a
   * space, so this is the branch that must say so out loud — a silent no-op
   * leaves the user unsure the gesture registered at all.
   */
  await dragTo(
    page,
    rowButton(tree, "Engineering"),
    rowButton(tree, "Sprint 14"),
  );

  await expect(toast(page, "Can't drop there")).toBeVisible();
  await expect(toast(page, "A space cannot go inside a list.")).toBeVisible();

  /*
   * Polled, not read once. The tree has no `DragOverlay`, so dnd-kit's
   * feedback plugin clones the dragged row into the DOM — and on a refused
   * drop that clone is still present, as a second "Engineering" treeitem,
   * until the return animation finishes.
   */
  await expect.poll(() => treeRows(page)).toEqual(SEEDED);
});

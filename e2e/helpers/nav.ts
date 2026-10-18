import { type Locator, type Page } from "@playwright/test";

import { type ViewId, VIEW_REGISTRY } from "@/config/views";

/**
 * The sidebar tree, with the mobile drawer opened first if needed.
 *
 * Below `lg` the Sidebar renders a focus-trapping Drawer rather than a static
 * aside, and TopBar shows an "Open navigation" button that does not exist at
 * all on wider viewports. That is a DOM difference, not a CSS one, so every
 * tree interaction goes through here to work in both projects.
 *
 * Idempotent, and worth re-calling: on mobile the drawer passes
 * `onAfterSelect={closeSheet}`, so selecting a list unmounts the tree.
 */
export async function openTree(page: Page): Promise<Locator> {
  const toggle = page.getByRole("button", { name: "Open navigation" });

  if (await toggle.isVisible()) {
    await toggle.click();
  }

  return page.getByRole("tree", { name: "Workspace" });
}

/**
 * A row of the tree, addressed by its visible name.
 *
 * Note the tree's top level is the *spaces* — the workspace itself ("Acme") is
 * not a row.
 */
export function treeItem(tree: Locator, name: string): Locator {
  return tree.getByRole("treeitem").filter({ hasText: name }).first();
}

/**
 * Clicks a row's own button.
 *
 * `exact` matters: every row also carries a "{name} actions" overflow button,
 * and Playwright matches accessible names by substring unless told otherwise —
 * so a loose name would match two elements and trip strict mode.
 */
export function rowButton(tree: Locator, name: string): Locator {
  return treeItem(tree, name).getByRole("button", { name, exact: true });
}

/** Expands a collapsed row. No-op when it is already open. */
export async function expand(tree: Locator, name: string): Promise<void> {
  const chevron = tree.getByRole("button", { name: `Expand ${name}` });

  if (await chevron.isVisible()) {
    await chevron.click();
  }
}

/** Selects a list by name, expanding the given ancestors on the way down. */
export async function selectList(
  page: Page,
  name: string,
  ancestors: readonly string[] = [],
): Promise<void> {
  const tree = await openTree(page);

  for (const ancestor of ancestors) {
    await expand(tree, ancestor);
  }

  await rowButton(tree, name).click();
}

/**
 * Switches view, through whichever control the viewport offers.
 *
 * The ViewSwitcher is `hidden md:inline-flex` — present in the DOM but not
 * visible on a phone, where the same two options live in the "More" menu.
 */
export async function setView(page: Page, view: ViewId): Promise<void> {
  const { label } = VIEW_REGISTRY[view];
  const radio = page
    .getByRole("radiogroup", { name: "View" })
    .getByRole("radio", { name: label, exact: true });

  if (await radio.isVisible()) {
    await radio.click();
    return;
  }

  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: `${label} view` }).click();
}

/** A kanban column. `<section aria-label>` exposes itself as a region. */
export function column(page: Page, name: string): Locator {
  return page.getByRole("region", { name });
}

/**
 * A task card, addressed by title.
 *
 * The card already has a usable identity without a test id: `Card` carries
 * `aria-label={task.title}` and dnd-kit's accessibility plugin makes the drag
 * handle a `button`. `getByText` would not do — the title appears a second
 * time in the complete checkbox's visually hidden label.
 */
export function taskCard(scope: Locator, title: string): Locator {
  return scope.getByRole("button", { name: title, exact: true });
}

/** The topbar breadcrumb trail, which names the selected list. */
export function breadcrumb(page: Page): Locator {
  return page.getByRole("navigation", { name: "Breadcrumb" });
}

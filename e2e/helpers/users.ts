import { type Locator, type Page } from "@playwright/test";

import { closeTree } from "./nav";

/**
 * The user switcher, which is the control the brief's 30-second demo turns on.
 *
 * Switching is session state, not domain state — `persistence.test.ts` pins
 * that a user switch writes nothing — so it does not survive a reload. Every
 * assertion about a switch therefore has to be made in the same page instance,
 * which is also the point: Requirement 8.3 says the tree, board and drawer
 * re-resolve with no reload.
 */

/** The switcher's trigger, named for the action rather than the current user. */
export function userSwitcher(page: Page): Locator {
  return page.getByRole("button", { name: /^Switch user/ });
}

/**
 * Switches to a user by name.
 *
 * The menu item reads "{name} · {role}", so a bare name is a substring match
 * and that is deliberate here: a spec should not have to restate a role it is
 * not asserting.
 */
export async function switchUser(page: Page, name: string): Promise<void> {
  /*
   * The switcher lives in the top bar, which is outside the navigation sheet —
   * and on a phone that sheet is a modal Dialog that hides the rest of the
   * document from the accessibility tree. Closing it here rather than in every
   * spec keeps "assert the tree, then switch user" readable at the call site.
   */
  await closeTree(page);

  await userSwitcher(page).click();
  await page.getByRole("menuitem", { name }).click();
}

/**
 * Opens a tree row's overflow menu.
 *
 * Separate from `rowButton` in `nav.ts`: that one is the row's own label
 * button, this is the "{name} actions" trigger beside it. The two have
 * overlapping accessible names, which is why both are addressed exactly.
 */
export async function openRowMenu(tree: Locator, name: string): Promise<void> {
  await tree
    .getByRole("button", { name: `${name} actions` })
    .first()
    .click();
}

/**
 * The clickable target for a checkbox row, which is its `<label>`.
 *
 * `getByRole("checkbox")` resolves to the `<input>`, and `Checkbox` renders
 * that input `sr-only` with a styled `<span>` as the visible box — so
 * Playwright's hit test at the input's 1px centre never resolves to it and
 * `check()`/`uncheck()` retries until the test times out. Clicking the label
 * is both what works and what a user does.
 *
 * State is still read from the input, via `getByRole`, because that is where
 * `checked` and `aria-checked` live. Click the label, assert the role.
 */
export function checkboxRow(scope: Locator, name: string): Locator {
  return scope.locator("label").filter({ hasText: name });
}

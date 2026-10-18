import { type Locator, type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { breadcrumb, treeItem } from "./helpers/nav";

/**
 * The off-canvas navigation drawer.
 *
 * Nothing in the unit suite mentions it — no test references "Workspace
 * navigation" — and it is not testable there in any meaningful way: which form
 * the sidebar takes is decided by `matchMedia`, which is stubbed to desktop,
 * and the behaviour that matters is Headless UI's focus trap, which needs a
 * real focus implementation rather than jsdom's.
 */

test.skip(
  ({ isMobile }) => isMobile !== true,
  "The drawer only exists below the lg breakpoint.",
);

function toggle(page: Page): Locator {
  return page.getByRole("button", { name: "Open navigation" });
}

/**
 * The dialog root.
 *
 * Deliberately not asserted with `toBeVisible`: `Drawer` puts `aria-label` on
 * Headless UI's `Dialog`, which renders a zero-size `relative z-40` wrapper,
 * while the thing with dimensions is the `DialogPanel` inside it. So the root
 * is the right element for containment checks and for `toBeHidden` once it
 * unmounts, and `panel()` below is what "is it open" asks about.
 */
function drawer(page: Page): Locator {
  return page.getByRole("dialog", { name: "Workspace navigation" });
}

/** Something inside the panel with real dimensions, to assert it is open. */
function panel(page: Page): Locator {
  return drawer(page).getByRole("tree", { name: "Workspace" });
}

test("opens, traps focus, and restores it on Escape", async ({ page }) => {
  await expect(breadcrumb(page)).toContainText("Backlog");

  await toggle(page).click();
  await expect(panel(page)).toBeVisible();

  /* Entry condition of the trap: focus is moved inside the panel. */
  await expect
    .poll(() =>
      drawer(page).evaluate((root) => root.contains(document.activeElement)),
    )
    .toBe(true);

  /*
   * And it stays inside. Tabbing past the last focusable element has to wrap
   * rather than escape to the page behind, or a keyboard user ends up driving
   * a board they cannot see.
   */
  for (let press = 0; press < 12; press += 1) {
    await page.keyboard.press("Tab");
  }

  expect(
    await drawer(page).evaluate((root) =>
      root.contains(document.activeElement),
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");

  await expect(drawer(page)).toBeHidden();
  /* Focus goes back to what opened it, not to the top of the document. */
  await expect(toggle(page)).toBeFocused();
});

test("closes itself when a list is selected", async ({ page }) => {
  await toggle(page).click();
  await expect(panel(page)).toBeVisible();

  await treeItem(drawer(page), "Sprint 14")
    .getByRole("button", { name: "Sprint 14", exact: true })
    .click();

  /*
   * `onAfterSelect={closeSheet}`: on a phone the drawer covers the board, so
   * leaving it open after a selection would hide the thing just chosen.
   */
  await expect(drawer(page)).toBeHidden();
  await expect(breadcrumb(page)).toContainText("Sprint 14");
});

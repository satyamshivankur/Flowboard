import { expect, test } from "./fixtures";
import {
  breadcrumb,
  expand,
  openTree,
  rowButton,
  treeItem,
  treeRows,
} from "./helpers/nav";
import {
  checkboxRow,
  openRowMenu,
  switchUser,
  userSwitcher,
} from "./helpers/users";

/**
 * The permission difference, in a real browser.
 *
 * This is the flow the brief singles out twice — "switching users must
 * immediately reflect what the tree and boards show", and "Alice vs Bob
 * difference is demoable in under 30 seconds" — and it was the one flow with
 * no E2E spec. It is covered in jsdom by `AppShell.test.tsx` and
 * `views/sidebar/access.test.tsx`, and those tests are sound; what this adds
 * is that the whole stack does it in a browser, against the built app.
 *
 * Every assertion reads the **tree**, never the store. A spec that inspected
 * `localStorage` for grant rows would pass with a sidebar that renders the
 * wrong thing, which is exactly the bug worth catching here.
 *
 * The seed's two grants are what make this demoable at all: Marketing is
 * `private` with an allow for Carol, and Infra is `public` with an explicit
 * deny for Bob. One proves a grant opens a private subtree, the other proves
 * deny beats public inheritance.
 */

test("the switcher names the current user and their role", async ({ page }) => {
  await expect(userSwitcher(page)).toHaveAccessibleName(
    /currently Alice Nguyen, Admin/,
  );

  await switchUser(page, "Bob Mensah");

  await expect(userSwitcher(page)).toHaveAccessibleName(
    /currently Bob Mensah, Member/,
  );
});

test("Alice sees the private space and Bob does not", async ({ page }) => {
  const tree = await openTree(page);

  await expect(treeItem(tree, "Marketing")).toBeVisible();

  await switchUser(page, "Bob Mensah");

  await expect(treeItem(await openTree(page), "Marketing")).toBeHidden();

  /* Carol holds the allow grant on it, so it comes back for her. */
  await switchUser(page, "Carol Diaz");

  await expect(treeItem(await openTree(page), "Marketing")).toBeVisible();
});

test("an explicit deny beats public inheritance", async ({ page }) => {
  const tree = await openTree(page);

  await expand(tree, "Platform");

  /* Infra is public; every ancestor is public; only Bob's deny hides it. */
  await expect(treeItem(tree, "Infra")).toBeVisible();

  await switchUser(page, "Bob Mensah");

  const forBob = await openTree(page);

  await expand(forBob, "Platform");

  await expect(treeItem(forBob, "Infra")).toBeHidden();

  /*
   * Platform itself stays — Bob can see the folder and none of its lists, which
   * is what the "no lists you can access" hint exists for (Requirement 6.8).
   * A folder that vanished with its only list would hide the denial instead of
   * explaining it.
   */
  await expect(treeItem(forBob, "Platform")).toBeVisible();
  await expect(forBob.getByText("No lists you can access")).toBeVisible();
});

/*
 * The 30-second demo, as one assertion. Comparing the whole tree rather than
 * probing row by row is what makes it a demo rather than three facts: the
 * levels are included, so a reparent could not masquerade as a visibility
 * change.
 */
test("the three users see three different trees, with no reload", async ({
  page,
}) => {
  const tree = await openTree(page);

  await expand(tree, "Platform");

  expect(await treeRows(page)).toEqual([
    "1:Engineering",
    "2:Q2 Launch",
    "3:Backlog",
    "3:Sprint 14",
    "2:Platform",
    "3:Infra",
    "1:Marketing",
  ]);

  await switchUser(page, "Bob Mensah");

  expect(await treeRows(page)).toEqual([
    "1:Engineering",
    "2:Q2 Launch",
    "3:Backlog",
    "3:Sprint 14",
    "2:Platform",
  ]);

  await switchUser(page, "Carol Diaz");

  expect(await treeRows(page)).toEqual([
    "1:Engineering",
    "2:Q2 Launch",
    "3:Backlog",
    "3:Sprint 14",
    "2:Platform",
    "3:Infra",
    "1:Marketing",
  ]);
});

/*
 * Requirement 8.13. A list open when the user changes may stop being visible,
 * and an empty board at that point looks broken rather than forbidden — so the
 * content region has to say which it is and offer a way out.
 */
test("a list that becomes invisible explains itself and offers a way out", async ({
  page,
}) => {
  const tree = await openTree(page);

  await expand(tree, "Platform");
  await rowButton(tree, "Infra").click();

  await expect(breadcrumb(page)).toContainText("Infra");

  await switchUser(page, "Bob Mensah");

  await expect(page.getByText(/don't have access/i)).toBeVisible();

  /* The way out is a real control, not just advice. */
  await page.getByRole("button", { name: /^Open “/ }).click();

  await expect(breadcrumb(page)).toContainText("Backlog");
});

/*
 * Requirement 8.12: the View uses permission results only to disable and
 * explain. There is deliberately no path to a FORBIDDEN toast for a structural
 * action, because the affordance is disabled before it can be triggered — so
 * the disabled state *with its reason* is the observable contract.
 */
test("structural actions are disabled for a member, with a reason", async ({
  page,
}) => {
  await switchUser(page, "Bob Mensah");

  const tree = await openTree(page);

  await openRowMenu(tree, "Engineering");

  for (const label of ["Rename", "Archive", "Manage access"]) {
    const item = page.getByRole("menuitem", { name: label });

    await expect(item).toBeDisabled();
    await expect(item).toHaveAttribute("title", /admin/i);
  }
});

test("the same actions are enabled for an admin", async ({ page }) => {
  const tree = await openTree(page);

  await openRowMenu(tree, "Engineering");

  for (const label of ["Rename", "Archive", "Manage access"]) {
    await expect(page.getByRole("menuitem", { name: label })).toBeEnabled();
  }
});

/*
 * The two flows that drive a `Dialog`, which is why they are desktop-only.
 *
 * Not a product limitation — a documented limitation of Chromium's mobile
 * emulation in this harness. On the mobile project `window.innerWidth` reports
 * 788 while `documentElement.clientWidth` and `visualViewport.width` both
 * report 412, so the initial containing block is roughly 1.9x the visible
 * viewport. Media queries read the real width, so the app correctly renders
 * its phone layout — but `Dialog`'s wrapper is `fixed inset-0 flex items-end`,
 * so the panel is laid out against the larger box and its footer lands near
 * y=1533 in a visible area 839 tall. Playwright clicks in visual-viewport
 * coordinates, and the wrapper intercepts every attempt.
 *
 * Verified as emulation rather than a bug: with the create dialog open there is
 * exactly one `fixed inset-0` wrapper and exactly one "Create" button, and both
 * flows pass on chromium. The navigation sheet never hit this because `Drawer`
 * anchors its panel `inset-y-0 left-0`, so top-aligned content stays inside the
 * visible area — which is also why no existing mobile spec caught it first.
 *
 * Matches the skip convention in `tree-drag.spec.ts` and
 * `failure-rollback.spec.ts`: cover the behaviour on one project rather than
 * fudge it on both.
 */
test.describe("access editing through its dialog", () => {
  test.skip(
    ({ isMobile }) => isMobile === true,
    "Dialog footers are unreachable under Chromium's mobile ICB emulation",
  );

  /*
   * Access editing end to end: an admin restricts a list, and another user loses
   * it. `access.test.tsx` already asserts this in jsdom; doing it once in a
   * browser is what proves the dialog, the grant write and the tree filter agree
   * across a real build — three layers that each have their own tests and had
   * never been run together outside jsdom.
   */
  test("restricting a list removes it for everyone left out", async ({
    page,
  }) => {
    const tree = await openTree(page);

    await openRowMenu(tree, "Backlog");
    await page.getByRole("menuitem", { name: "Manage access" }).click();

    const dialog = page.getByRole("dialog");

    /* Backlog is public in the seed, so the select-all starts checked. */
    await expect(
      dialog.getByRole("checkbox", { name: /everyone in the workspace/i }),
    ).toBeChecked();

    await checkboxRow(dialog, "Bob Mensah").click();

    await expect(
      dialog.getByRole("checkbox", { name: "Bob Mensah" }),
    ).not.toBeChecked();
    /* Everyone minus one is no longer "everyone", so the select-all goes mixed. */
    await expect(
      dialog.getByRole("checkbox", { name: /everyone in the workspace/i }),
    ).toHaveAttribute("aria-checked", "mixed");

    await dialog.getByRole("button", { name: "Save access" }).click();

    await expect(dialog).toBeHidden();

    /* The row now advertises the restriction without the dialog being open. */
    await expect(
      (await openTree(page)).getByText("Restricted access").first(),
    ).toBeAttached();

    await switchUser(page, "Bob Mensah");

    const forBob = await openTree(page);

    await expect(treeItem(forBob, "Backlog")).toBeHidden();
    /* Only Backlog changed; its sibling is still his. */
    await expect(treeItem(forBob, "Sprint 14")).toBeVisible();
  });

  /*
   * Requirement 8.15: a container created now reaches admins only until someone
   * widens it. The old default made every new container visible to the whole
   * workspace, which is the behaviour this asserts is gone — and it is worth one
   * browser test because "fails closed" is the kind of claim that is easy to
   * regress and invisible when it does.
   */
  test("a newly created space reaches admins only", async ({ page }) => {
    await openTree(page);

    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("menuitem", { name: /new space/i }).click();

    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Name").fill("Finance");
    await expect(dialog).toContainText(/only admins will be able to see/i);

    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(dialog).toBeHidden();

    await expect(treeItem(await openTree(page), "Finance")).toBeVisible();

    await switchUser(page, "Bob Mensah");

    await expect(treeItem(await openTree(page), "Finance")).toBeHidden();
  });
});

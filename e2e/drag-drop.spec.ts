import { expect, test } from "./fixtures";
import { columnOrder, dragOver, dragTo, startDrag } from "./helpers/drag";
import { breadcrumb, column, taskCard } from "./helpers/nav";
import { seedState } from "./helpers/seed";

/**
 * The reason this suite exists.
 *
 * `dragDrop.test.ts` already owns the arithmetic — `planFrom`, `locate`,
 * `isNoOpDrop`, `columnsFromPlan` — and it is thorough. What it cannot reach
 * is any of this: jsdom has no layout, so every rect is zero and collision
 * detection has nothing to resolve against. Both of the bugs that followed the
 * dnd-kit migration (a `removeChild` crash dropping into a populated column, a
 * silent no-op dropping into an empty one) were invisible to a green suite.
 *
 * All of these run in Backlog, whose three columns hold no subtasks — so a
 * column's draggable set is exactly its cards.
 */

/* Backlog, as seeded. */
const FIRST = "Define onboarding checklist for new workspaces";
const SECOND = "Audit empty states across the product";
const THIRD = "Draft the Q3 roadmap outline";
const ACTIVE_FIRST = "Rework the task detail layout";
const ACTIVE_SECOND = "Replace ad-hoc spacing with the shared scale";
const DONE_ONLY = "Agree the colour token naming scheme";

test.describe("pointer drag", () => {
  /*
   * Desktop only, and deliberately. On a phone the sensor wants a 200ms press
   * rather than 8px of travel, and the board is a snap-scrolled single column
   * — so a cross-column pointer drag is not the gesture a phone user makes.
   * The keyboard path below is the one that has to work everywhere.
   */
  test.skip(
    ({ isMobile }) => isMobile === true,
    "Pointer drag is a desktop gesture; the phone equivalent is long-press.",
  );

  test("reorders within a column", async ({ page }) => {
    await expect(breadcrumb(page)).toContainText("Backlog");
    expect(await columnOrder(page, "To do")).toEqual([FIRST, SECOND, THIRD]);

    const todo = column(page, "To do");

    /* Released in the top quarter of the first card, so it inserts above it. */
    await dragTo(page, taskCard(todo, THIRD), taskCard(todo, FIRST), {
      at: 0.2,
    });

    await expect
      .poll(() => columnOrder(page, "To do"))
      .toEqual([THIRD, FIRST, SECOND]);
  });

  test("moves a card to another column and persists it", async ({ page }) => {
    const todo = column(page, "To do");
    const active = column(page, "In progress");

    await dragTo(page, taskCard(todo, THIRD), taskCard(active, ACTIVE_SECOND));

    /*
     * Asserted as arrival-and-departure rather than as an exact index, and
     * that is a considered line rather than a weaker test.
     *
     * Which index a cross-column drop lands on depends on the pointer's side
     * of the target card's centre at the moment the last `onDragOver`
     * resolves, so it moves with the release point — releasing at 0.5 of this
     * card appends, releasing at 0.8 inserts above it. That arithmetic is
     * already pinned by `locate` and `isNoOpDrop` in `dragDrop.test.ts`, where
     * it can be stated exactly instead of approached through geometry.
     *
     * What only a browser can establish is the rest of it: that the crossing
     * happens at all, that both columns agree afterwards, that the residents
     * keep their order, and that it survives a reload.
     */
    await expect.poll(() => columnOrder(page, "In progress")).toContain(THIRD);

    const arrived = await columnOrder(page, "In progress");

    expect(arrived).toHaveLength(3);
    expect(arrived.filter((title) => title !== THIRD)).toEqual([
      ACTIVE_FIRST,
      ACTIVE_SECOND,
    ]);
    expect(await columnOrder(page, "To do")).toEqual([FIRST, SECOND]);

    /*
     * The move is the app's one optimistic mutation: the card lands under the
     * cursor before the transport answers. A reload is what distinguishes
     * "rendered optimistically" from "actually committed and saved".
     */
    await page.reload();

    await expect
      .poll(() => columnOrder(page, "In progress"))
      .toEqual([ACTIVE_FIRST, ACTIVE_SECOND, THIRD]);
  });

  test("drops into an empty column", async ({ page }) => {
    /*
     * No seeded column is empty, and an empty one is the case worth testing:
     * the pointer there collides with the column's own droppable rather than
     * with any card, which dnd-kit's optimistic sorting ignores outright. That
     * is the path that used to do nothing at all.
     */
    await seedState(page, (state) => {
      const { "t-006": _removed, ...tasks } = state.tasks;

      return { ...state, tasks };
    });
    await page.reload();

    const done = column(page, "Done");

    await expect(done.getByText("No tasks")).toBeVisible();

    await dragTo(page, taskCard(column(page, "To do"), THIRD), done, {
      /* Low in the section, clear of its header. */
      at: 0.8,
    });

    await expect.poll(() => columnOrder(page, "Done")).toEqual([THIRD]);
    expect(await columnOrder(page, "To do")).toEqual([FIRST, SECOND]);
  });

  test("Escape cancels a drag and writes nothing", async ({ page }) => {
    const todo = column(page, "To do");
    const active = column(page, "In progress");

    await startDrag(page, taskCard(todo, THIRD));
    await dragOver(page, taskCard(active, ACTIVE_FIRST));

    /*
     * The live preview, which is the thing jsdom cannot show at all: the board
     * mirrors the move into React state during `onDragOver`, so the card has
     * already left "To do" and joined "In progress" while the button is still
     * held down. That mirroring is not cosmetic — it is what makes dnd-kit's
     * `OptimisticSortingPlugin` stand down instead of calling
     * `insertAdjacentElement` and leaving React to crash on `removeChild`.
     */
    await expect.poll(() => columnOrder(page, "In progress")).toContain(THIRD);
    expect(await columnOrder(page, "To do")).toEqual([FIRST, SECOND]);

    await page.keyboard.press("Escape");
    await page.mouse.up();

    await expect
      .poll(() => columnOrder(page, "To do"))
      .toEqual([FIRST, SECOND, THIRD]);
    expect(await columnOrder(page, "In progress")).toEqual([
      ACTIVE_FIRST,
      ACTIVE_SECOND,
    ]);
  });

  test("dropping a card back where it started writes nothing", async ({
    page,
  }) => {
    const todo = column(page, "To do");

    await dragTo(page, taskCard(todo, SECOND), taskCard(todo, SECOND));

    await expect
      .poll(() => columnOrder(page, "To do"))
      .toEqual([FIRST, SECOND, THIRD]);
    /* A no-op drop must not surface as a change, successful or otherwise. */
    await expect(page.getByText("Connection problem")).toBeHidden();
  });
});

test.describe("keyboard drag", () => {
  /*
   * The path that must work on every project and with assistive tech. Space
   * picks up, arrows move, Space commits — Enter is deliberately absent from
   * the board's keyboard codes because it opens the drawer.
   */
  test("moves a card down its column with Space and arrows", async ({
    page,
  }) => {
    const todo = column(page, "To do");

    expect(await columnOrder(page, "To do")).toEqual([FIRST, SECOND, THIRD]);

    await taskCard(todo, FIRST).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");

    await expect
      .poll(() => columnOrder(page, "To do"))
      .toEqual([SECOND, FIRST, THIRD]);
  });

  test("picking up and dropping without moving writes nothing", async ({
    page,
  }) => {
    const todo = column(page, "To do");

    await taskCard(todo, FIRST).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");

    await expect
      .poll(() => columnOrder(page, "To do"))
      .toEqual([FIRST, SECOND, THIRD]);
  });
});

test("the single Done card is still reorderable through the menu", async ({
  page,
}) => {
  /*
   * Not a drag, but the refusal that pairs with one: reordering is reachable
   * from the card menu for anyone who cannot drag, and the menu has to say so
   * rather than offering a move that does nothing.
   */
  const card = taskCard(column(page, "Done"), DONE_ONLY);

  await card.getByRole("button", { name: `Actions for ${DONE_ONLY}` }).click();

  await expect(page.getByRole("menuitem", { name: "Move up" })).toBeDisabled();
  await expect(
    page.getByRole("menuitem", { name: "Move down" }),
  ).toBeDisabled();
});

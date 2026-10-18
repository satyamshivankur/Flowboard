import { type Locator, type Page } from "@playwright/test";

import { column } from "./nav";

/**
 * Pointer-driven drag and drop for dnd-kit.
 *
 * `locator.dragTo()` is not enough here. The board's `PointerSensor` is
 * configured with `Distance({ value: 8 })` for a fine pointer — so a click
 * still opens a card instead of nudging it — and collision detection is
 * pointer-first. A single jump from source to target can satisfy the distance
 * while giving the manager no intermediate positions to resolve against, so
 * the drag either never activates or activates with nothing under it.
 *
 * Hence the shape below: one small move to trip the threshold, then a stepped
 * traverse, then a final event at rest before release so the last
 * `onDragOver` has landed before `onDragEnd` reads the plan.
 */

export interface DragOptions {
  /**
   * Where to release within the target, as a fraction of its height.
   * dnd-kit inserts before or after a target depending on which side of its
   * centre the pointer is, so this is how a spec says "above" or "below".
   */
  readonly at?: number;
}

export async function dragTo(
  page: Page,
  from: Locator,
  to: Locator,
  options: DragOptions = {},
): Promise<void> {
  const { at = 0.5 } = options;

  await from.scrollIntoViewIfNeeded();
  await to.scrollIntoViewIfNeeded();

  const source = (await from.boundingBox())!;
  const target = (await to.boundingBox())!;

  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  const endX = target.x + target.width / 2;
  const endY = target.y + target.height * at;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  /* Past the 8px activation constraint, on its own, before going anywhere. */
  await page.mouse.move(startX + 12, startY, { steps: 3 });
  await page.mouse.move(endX, endY, { steps: 20 });
  /* One more at rest: the last target change has to resolve before release. */
  await page.mouse.move(endX, endY);
  await page.mouse.up();
}

/** Picks a card up without dropping it, leaving the button held down. */
export async function startDrag(page: Page, from: Locator): Promise<void> {
  const source = (await from.boundingBox())!;
  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 12, startY, { steps: 3 });
}

/** Moves the held pointer onto a target without releasing it. */
export async function dragOver(page: Page, to: Locator): Promise<void> {
  const target = (await to.boundingBox())!;

  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 20 },
  );
}

/**
 * The titles of the draggable cards in a column, in render order.
 *
 * `[aria-roledescription="draggable"]` is applied by dnd-kit's accessibility
 * plugin to the drag handle, which is the parent card's own element. That
 * makes it a precise filter rather than a convenience: a subtask card has a
 * `role` and an `aria-label` but is deliberately not draggable, so it does not
 * match and does not pollute the column's order.
 */
export async function columnOrder(
  page: Page,
  name: string,
): Promise<string[]> {
  return column(page, name)
    .locator('[aria-roledescription="draggable"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-label") ?? ""),
    );
}

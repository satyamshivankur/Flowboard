import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Tooltip } from "./Tooltip";

/**
 * The bug these guard against: an absolutely positioned tooltip is clipped by
 * any ancestor with `overflow` set, and `z-index` cannot escape an overflow
 * clip. Every consumer in this app sits inside at least one such ancestor —
 * tree rows in the sidebar's scroll container, card avatars in a board
 * column's, everything inside the shell's `overflow-hidden`.
 *
 * Asserting the tooltip is portalled out of the clipping ancestor is the only
 * way to catch a regression here without a screenshot: in jsdom there is no
 * layout, so nothing about the rendered output looks wrong.
 */

/** A trigger wrapped in the kind of scroll container the app really uses. */
function ClippedTooltip() {
  return (
    <div data-testid="clipper" className="h-8 overflow-y-auto">
      <Tooltip content="Full name that was truncated">
        <button type="button">Trigger</button>
      </Tooltip>
    </div>
  );
}

describe("Tooltip escapes clipping ancestors", () => {
  it("renders into document.body rather than inside the overflow container", async () => {
    const user = userEvent.setup();

    render(<ClippedTooltip />);

    await user.hover(screen.getByRole("button", { name: "Trigger" }));

    const tooltip = screen.getByRole("tooltip");
    const clipper = screen.getByTestId("clipper");

    expect(clipper).not.toContainElement(tooltip);
    expect(tooltip.parentElement).toBe(document.body);
  });

  it("positions itself with fixed coordinates", async () => {
    const user = userEvent.setup();

    render(<ClippedTooltip />);

    await user.hover(screen.getByRole("button", { name: "Trigger" }));

    const tooltip = screen.getByRole("tooltip");

    expect(tooltip).toHaveClass("fixed");
    // Coordinates are inline because a viewport position cannot be a class.
    expect(tooltip.style.top).not.toBe("");
    expect(tooltip.style.left).not.toBe("");
  });
});

describe("Tooltip show and hide", () => {
  it("is absent until hovered", () => {
    render(<ClippedTooltip />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("appears on hover and disappears on unhover", async () => {
    const user = userEvent.setup();

    render(<ClippedTooltip />);

    const trigger = screen.getByRole("button", { name: "Trigger" });

    await user.hover(trigger);

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Full name that was truncated",
    );

    await user.unhover(trigger);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("appears on keyboard focus and clears on blur", async () => {
    const user = userEvent.setup();

    render(
      <>
        <ClippedTooltip />
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.tab();

    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    await user.tab();

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  /*
   * The tooltip is referenced only while shown. A permanent `aria-describedby`
   * pointing at an absent node is a dangling reference.
   */
  it("links the trigger to the tooltip only while it is shown", async () => {
    const user = userEvent.setup();

    render(<ClippedTooltip />);

    const trigger = screen.getByRole("button", { name: "Trigger" });

    expect(trigger).not.toHaveAttribute("aria-describedby");

    await user.hover(trigger);

    expect(trigger).toHaveAttribute("aria-describedby");
    expect(trigger).toHaveAccessibleDescription(
      "Full name that was truncated",
    );

    await user.unhover(trigger);

    expect(trigger).not.toHaveAttribute("aria-describedby");
  });

  /*
   * Suppression on touch is a `can-hover` media variant rather than a
   * JavaScript check, so the element is present but never painted. Asserting
   * the class is the only way to verify it in jsdom, which applies no CSS.
   */
  it("carries the can-hover gate so touch never paints it", async () => {
    const user = userEvent.setup();

    render(<ClippedTooltip />);

    await user.hover(screen.getByRole("button", { name: "Trigger" }));

    const tooltip = screen.getByRole("tooltip");

    expect(tooltip).toHaveClass("hidden");
    expect(tooltip).toHaveClass("can-hover:block");
  });
});

describe("Tooltip side", () => {
  it("applies the transform for each side", async () => {
    const user = userEvent.setup();

    for (const [side, expected] of [
      ["top", "-translate-y-full"],
      ["bottom", "-translate-x-1/2"],
      ["left", "-translate-x-full"],
      ["right", "-translate-y-1/2"],
    ] as const) {
      const { unmount } = render(
        <Tooltip content="Positioned" side={side}>
          <button type="button">{side}</button>
        </Tooltip>,
      );

      await user.hover(screen.getByRole("button", { name: side }));

      expect(screen.getByRole("tooltip")).toHaveClass(expected);

      unmount();
    }
  });
});

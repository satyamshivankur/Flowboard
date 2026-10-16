import { render, screen } from "@testing-library/react";
import { Search, X } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Input } from "./Input";

/**
 * These assert resolved class names, which is normally a brittle thing to test.
 * It is warranted here because the bug being guarded was a *silently deleted*
 * class: `cn("pl-8", "px-3")` resolves to `"px-3"`, since tailwind-merge treats
 * `px` as overriding an earlier `pl`. The leading-icon padding never reached the
 * DOM, so the icon overlapped the text — with nothing wrong in the source to
 * see and no error anywhere.
 *
 * Asserting the padding survives the merge is the only way to catch a
 * reintroduction without a screenshot.
 */
describe("Input slot padding survives class merging", () => {
  it("applies leading padding when a leading icon is present", () => {
    render(<Input label="Search" leadingIcon={Search} />);

    const input = screen.getByLabelText("Search");

    expect(input.className).toContain("pl-9");
  });

  it("applies trailing padding when a trailing slot is present", () => {
    render(<Input label="Filter" trailingSlot={<X />} />);

    expect(screen.getByLabelText("Filter").className).toContain("pr-9");
  });

  it("applies both when the input has a leading icon and a trailing slot", () => {
    render(<Input label="Both" leadingIcon={Search} trailingSlot={<X />} />);

    const className = screen.getByLabelText("Both").className;

    expect(className).toContain("pl-9");
    expect(className).toContain("pr-9");
  });

  it("uses the tighter padding at the small size", () => {
    render(<Input label="Small" inputSize="sm" leadingIcon={Search} />);

    const className = screen.getByLabelText("Small").className;

    expect(className).toContain("pl-8");
    expect(className).not.toContain("pl-9");
  });

  it("adds no slot padding when there are no slots", () => {
    render(<Input label="Plain" />);

    const className = screen.getByLabelText("Plain").className;

    expect(className).not.toContain("pl-9");
    expect(className).not.toContain("pr-9");
    expect(className).toContain("px-3");
  });

  /*
   * A caller's className is merged last and must still win, so a one-off
   * adjustment is possible without forking the component (Requirement 11.3).
   */
  it("lets a caller override the slot padding", () => {
    render(<Input label="Override" leadingIcon={Search} className="pl-12" />);

    const className = screen.getByLabelText("Override").className;

    expect(className).toContain("pl-12");
    expect(className).not.toContain("pl-9");
  });
});

describe("Input accessibility wiring", () => {
  it("associates the label with the input", () => {
    render(<Input label="Title" />);

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("marks the field invalid and links the message when there is an error", () => {
    render(<Input label="Title" error="Title is required." />);

    const input = screen.getByLabelText("Title");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Title is required.");
  });

  it("links a hint the same way", () => {
    render(<Input label="Title" hint="Max 500 characters" />);

    const input = screen.getByLabelText("Title");

    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Max 500 characters");
  });

  /* An error replaces the hint rather than stacking two descriptions. */
  it("prefers the error over the hint", () => {
    render(<Input label="Title" hint="Max 500" error="Too long." />);

    expect(screen.getByLabelText("Title")).toHaveAccessibleDescription(
      "Too long.",
    );
  });

  it("keeps a hidden label available to assistive technology", () => {
    render(<Input label="Search tasks" labelHidden />);

    expect(screen.getByLabelText("Search tasks")).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DatePicker } from "./DatePicker";

/**
 * The date field and its calendar.
 *
 * Selection is calendar-only: there is no text field. That removes a class of
 * input error but makes the keyboard path longer, so the movement keys are the
 * thing most worth protecting here — a grid reachable only by clicking would
 * be a regression on the native input it replaced (Requirement 17.1).
 */

/** A fixed "today" so the opening month and the today ring are deterministic. */
const NOW = "2026-10-16T09:00:00.000Z";

function Harness({
  initial = null,
  disabled = false,
  onChange,
}: {
  initial?: string | null;
  disabled?: boolean;
  onChange?: (value: string | null) => void;
}) {
  const [value, setValue] = useState<string | null>(initial);

  return (
    <DatePicker
      label="Due date"
      value={value}
      disabled={disabled}
      now={NOW}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

function trigger() {
  return screen.getByRole("button", { name: "Due date" });
}

async function openCalendar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trigger());

  return screen.findByRole("grid");
}

/**
 * A day cell, by ISO date.
 *
 * Looked up through `data-day` rather than by accessible name: the name is
 * `Intl`-formatted, so matching it would pin these tests to whatever locale
 * the runner happens to have. One test below asserts the name itself, built
 * with the same formatter.
 */
function day(iso: string): HTMLElement {
  const cell = screen
    .getByRole("grid")
    .querySelector<HTMLElement>(`[data-day="${iso}"]`);

  if (cell === null) throw new Error(`No day cell for ${iso}`);

  return cell;
}

describe("there is no typed entry", () => {
  /*
   * The requirement, asserted directly: the trigger is a button, and nothing
   * in the field or the popover accepts text.
   */
  it("offers no text input anywhere", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-10-21T09:00:00.000Z" />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(trigger().tagName).toBe("BUTTON");

    await openCalendar(user);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("shows the formatted date on the trigger, not an editable value", () => {
    render(<Harness initial="2026-10-21T09:00:00.000Z" />);

    // Same formatter `DueDateChip` uses, so the field and the card agree.
    expect(trigger()).toHaveTextContent("Oct 21");
  });

  it("shows a placeholder when unset", () => {
    render(<Harness />);

    expect(trigger()).toHaveTextContent("No date");
  });
});

describe("choosing from the calendar", () => {
  it("opens on the selected month and marks the selected day", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-11-03T09:00:00.000Z" />);

    const grid = await openCalendar(user);

    expect(grid).toHaveAccessibleName(/November 2026/);
    expect(day("2026-11-03")).toHaveAttribute("aria-selected", "true");
  });

  it("opens on the current month when nothing is selected, and marks today", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    const grid = await openCalendar(user);

    expect(grid).toHaveAccessibleName(/October 2026/);

    /*
     * The name says "today" rather than leaving it to the ring, so the state
     * is not conveyed visually alone (Requirement 17.7). Built with the same
     * `Intl` options the component uses, so this holds in any locale.
     */
    const readable = new Date(2026, 9, 16).toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    expect(day("2026-10-16")).toHaveAccessibleName(`${readable}, today`);
  });

  it("selects a day and closes, updating the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Harness onChange={onChange} />);

    await openCalendar(user);

    await user.click(day("2026-10-21"));

    expect(onChange).toHaveBeenCalledWith("2026-10-21T09:00:00.000Z");

    // Picking is the panel's whole purpose, so it dismisses itself.
    await waitFor(() => {
      expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    });

    expect(trigger()).toHaveTextContent("Oct 21");
  });

  it("pages between months", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await openCalendar(user);

    await user.click(screen.getByRole("button", { name: "Next month" }));

    await waitFor(() => {
      expect(screen.getByRole("grid")).toHaveAccessibleName(/November 2026/);
    });

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    await user.click(screen.getByRole("button", { name: "Previous month" }));

    await waitFor(() => {
      expect(screen.getByRole("grid")).toHaveAccessibleName(/September 2026/);
    });
  });

  it("sets today from the footer", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Harness onChange={onChange} />);

    await openCalendar(user);
    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(onChange).toHaveBeenCalledWith("2026-10-16T09:00:00.000Z");
  });

  it("respects min and max bounds", async () => {
    const user = userEvent.setup();

    render(
      <DatePicker
        label="Due date"
        value={null}
        now={NOW}
        minDate={new Date(2026, 9, 16)}
        onChange={() => undefined}
      />,
    );

    await openCalendar(user);

    expect(day("2026-10-15")).toBeDisabled();
    expect(day("2026-10-16")).not.toBeDisabled();
  });
});

describe("clearing", () => {
  it("clears from the field without opening the calendar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Harness initial="2026-10-21T09:00:00.000Z" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Clear due date" }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("clears from the calendar footer too", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Harness initial="2026-10-21T09:00:00.000Z" onChange={onChange} />);

    await openCalendar(user);
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("offers no clear affordance when there is nothing to clear", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    expect(
      screen.queryByRole("button", { name: "Clear due date" }),
    ).not.toBeInTheDocument();

    await openCalendar(user);

    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });
});

describe("keyboard navigation", () => {
  /*
   * With no text field this is the *only* way to reach a date from the
   * keyboard, so it carries more weight than it did before. The library
   * supplies `aria-selected` and a roving `tabIndex` but no key handling at
   * all — every movement below is ours.
   */
  it("focuses a day in the grid as soon as the calendar opens", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-10-16T09:00:00.000Z" />);

    await openCalendar(user);

    // Not the month controls: the grid is the only thing here that selects.
    await waitFor(() => {
      expect(day("2026-10-16")).toHaveFocus();
    });
  });

  it("moves a day at a time with the arrow keys", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-10-16T09:00:00.000Z" />);

    await openCalendar(user);

    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      expect(day("2026-10-17")).toHaveFocus();
    });

    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      expect(day("2026-10-24")).toHaveFocus();
    });
  });

  it("selects the focused day with Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Harness initial="2026-10-16T09:00:00.000Z" onChange={onChange} />);

    await openCalendar(user);

    await user.keyboard("{ArrowRight}{Enter}");

    expect(onChange).toHaveBeenCalledWith("2026-10-17T09:00:00.000Z");
  });

  it("moves to the start and end of the week with Home and End", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-10-16T09:00:00.000Z" />);

    await openCalendar(user);

    // The 16th is a Friday; the week starts Monday the 12th.
    await user.keyboard("{Home}");

    await waitFor(() => {
      expect(day("2026-10-12")).toHaveFocus();
    });

    await user.keyboard("{End}");

    await waitFor(() => {
      expect(day("2026-10-18")).toHaveFocus();
    });
  });

  it("jumps a month with PageUp and PageDown", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-10-16T09:00:00.000Z" />);

    await openCalendar(user);

    await user.keyboard("{PageDown}");

    await waitFor(() => {
      expect(screen.getByRole("grid")).toHaveAccessibleName(/November 2026/);
    });

    expect(day("2026-11-16")).toHaveFocus();

    await user.keyboard("{PageUp}{PageUp}");

    await waitFor(() => {
      expect(screen.getByRole("grid")).toHaveAccessibleName(/September 2026/);
    });
  });

  /*
   * The mitigation for dropping typed entry: without a year jump, a date two
   * years out would be twenty-four PageDowns.
   */
  it("jumps a year with Shift and the Page keys", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-10-16T09:00:00.000Z" />);

    await openCalendar(user);

    await user.keyboard("{Shift>}{PageDown}{/Shift}");

    await waitFor(() => {
      expect(screen.getByRole("grid")).toHaveAccessibleName(/October 2027/);
    });

    expect(day("2027-10-16")).toHaveFocus();

    await user.keyboard("{Shift>}{PageUp}{PageUp}{/Shift}");

    await waitFor(() => {
      expect(screen.getByRole("grid")).toHaveAccessibleName(/October 2025/);
    });
  });

  /*
   * Crossing a month boundary with a single arrow key is the awkward case: the
   * target day does not exist in the DOM until the month re-renders around it.
   */
  it("pulls the month across when an arrow leaves it", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-10-31T09:00:00.000Z" />);

    await openCalendar(user);

    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      expect(screen.getByRole("grid")).toHaveAccessibleName(/November 2026/);
    });

    expect(day("2026-11-01")).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-10-16T09:00:00.000Z" />);

    await openCalendar(user);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(trigger()).toHaveFocus();
    });
  });

  /*
   * Forty-two tab stops in a calendar is not navigation. Exactly one day is
   * reachable by Tab, and it must be one that is on screen — an earlier
   * version left none at all after paging away.
   */
  it("keeps exactly one tabbable day, including after paging away", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-10-16T09:00:00.000Z" />);

    const grid = await openCalendar(user);

    const tabbable = grid.querySelectorAll('[data-day][tabindex="0"]');

    expect(tabbable).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Next month" }));
    await user.click(screen.getByRole("button", { name: "Next month" }));

    await waitFor(() => {
      expect(screen.getByRole("grid")).toHaveAccessibleName(/December 2026/);
    });

    expect(
      screen.getByRole("grid").querySelectorAll('[data-day][tabindex="0"]'),
    ).toHaveLength(1);
  });
});

describe("disabled", () => {
  it("does not open at all", async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-11-03T09:00:00.000Z" disabled />);

    expect(trigger()).toBeDisabled();

    await user.click(trigger());

    expect(screen.queryByRole("grid")).not.toBeInTheDocument();

    // The clear affordance is hidden rather than disabled: a read-only field
    // has nothing to clear.
    expect(
      screen.queryByRole("button", { name: "Clear due date" }),
    ).not.toBeInTheDocument();
  });
});

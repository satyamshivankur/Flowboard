import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Avatar } from "./Avatar";
import { PriorityBadge } from "./PriorityBadge";
import { Select, type SelectOption } from "./Select";
import { StatusPill } from "./StatusPill";

/**
 * `Select` option rendering.
 *
 * The bug these exist for: the component had separate `renderOption` and
 * `renderValue` callbacks, and the task drawer supplied only the second. The
 * closed trigger showed a status pill while the open list showed plain text,
 * and nothing failed — the component was doing exactly what it was told.
 *
 * Carrying the visual on the option removes the ability to specify one without
 * the other, and these assert both halves so a regression cannot pass.
 */

const STATUS_OPTIONS: SelectOption<string>[] = [
  {
    value: "todo",
    label: "To do",
    content: (
      <StatusPill name="To do" colorToken="status-todo" variant="dot-label" />
    ),
  },
  {
    value: "active",
    label: "In progress",
    content: (
      <StatusPill
        name="In progress"
        colorToken="status-active"
        variant="dot-label"
      />
    ),
  },
];

function Harness<T extends string>({
  options,
  initial = null,
  label = "Status",
  placeholder,
}: {
  options: readonly SelectOption<T>[];
  initial?: T | null;
  label?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState<T | null>(initial);

  return (
    <Select<T>
      label={label}
      value={value}
      onChange={setValue}
      options={options}
      {...(placeholder === undefined ? {} : { placeholder })}
    />
  );
}

/** The listbox options, which only exist once the trigger is opened. */
async function open(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name }));

  return screen.findByRole("listbox");
}

describe("custom option content", () => {
  it("renders the option's component in the list, not its plain label", async () => {
    const user = userEvent.setup();

    render(<Harness options={STATUS_OPTIONS} initial="todo" />);

    const listbox = await open(user, "Status");

    /*
     * The pill renders a dot as a separate element beside the name. Asserting
     * on it is how "a component rendered" is distinguished from "the label
     * string rendered" — both contain the text "To do".
     */
    for (const option of within(listbox).getAllByRole("option")) {
      expect(option.querySelector("[data-status-dot]")).not.toBeNull();
    }
  });

  it("renders the same component on the closed trigger", async () => {
    const user = userEvent.setup();

    render(<Harness options={STATUS_OPTIONS} initial="active" />);

    const trigger = screen.getByRole("button", { name: "Status" });

    expect(trigger.querySelector("[data-status-dot]")).not.toBeNull();
    expect(trigger).toHaveTextContent("In progress");

    // And after choosing a different one, the trigger follows.
    const listbox = await open(user, "Status");

    await user.click(within(listbox).getByRole("option", { name: "To do" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Status" })).toHaveTextContent(
        "To do",
      );
    });

    expect(
      screen
        .getByRole("button", { name: "Status" })
        .querySelector("[data-status-dot]"),
    ).not.toBeNull();
  });

  /*
   * An avatar-only option has no text of its own, so without an explicit name
   * it would be an unlabelled row — unreachable by name for a screen reader
   * and for a test (Requirement 17.1).
   */
  it("names an option from its label even when the content is graphical", async () => {
    const user = userEvent.setup();

    const options: SelectOption<string>[] = [
      {
        value: "u-alice",
        label: "Alice Nguyen",
        content: (
          <Avatar
            name="Alice Nguyen"
            avatarToken="avatar-indigo"
            size="xs"
            showTooltip={false}
          />
        ),
      },
    ];

    render(
      <Harness options={options} label="Assignee" placeholder="Unassigned" />,
    );

    const listbox = await open(user, "Assignee");

    expect(
      within(listbox).getByRole("option", { name: "Alice Nguyen" }),
    ).toBeInTheDocument();
  });

  it("lets the trigger differ from the row when asked", async () => {
    const user = userEvent.setup();

    const options: SelectOption<string>[] = [
      {
        value: "u-bob",
        label: "Bob Mensah",
        content: <span>Bob Mensah — Engineering</span>,
        triggerContent: <span>Bob</span>,
      },
    ];

    render(<Harness options={options} initial="u-bob" label="Assignee" />);

    // The compact form on the button…
    expect(screen.getByRole("button", { name: "Assignee" })).toHaveTextContent(
      "Bob",
    );
    expect(
      screen.getByRole("button", { name: "Assignee" }),
    ).not.toHaveTextContent("Engineering");

    // …and the full form in the row.
    const listbox = await open(user, "Assignee");

    expect(within(listbox).getByRole("option")).toHaveTextContent(
      "Bob Mensah — Engineering",
    );
  });

  it("falls back to the label when no content is given", async () => {
    const user = userEvent.setup();

    render(
      <Harness
        options={[
          { value: "dueDate:asc", label: "Due date — soonest" },
          { value: "title:asc", label: "Title — A to Z" },
        ]}
        initial="dueDate:asc"
        label="Sort by"
      />,
    );

    expect(screen.getByRole("button", { name: "Sort by" })).toHaveTextContent(
      "Due date — soonest",
    );

    const listbox = await open(user, "Sort by");

    expect(
      within(listbox).getByRole("option", { name: "Title — A to Z" }),
    ).toBeInTheDocument();
  });

  it("shows the placeholder when nothing is selected", () => {
    render(
      <Harness
        options={STATUS_OPTIONS}
        label="Status"
        placeholder="Pick a status…"
      />,
    );

    expect(screen.getByRole("button", { name: "Status" })).toHaveTextContent(
      "Pick a status…",
    );
  });
});

describe("rows accommodate the content they are given", () => {
  /*
   * The row height was a fixed `h-8`, which clips a pill or an avatar. Fixed
   * heights are the reason a custom component looks broken in a dropdown even
   * when it is rendering correctly, so the class is asserted directly — there
   * is no layout in jsdom to measure.
   */
  it("sizes rows with min-height rather than a fixed height", async () => {
    const user = userEvent.setup();

    render(<Harness options={STATUS_OPTIONS} initial="todo" />);

    const listbox = await open(user, "Status");
    const option = within(listbox).getAllByRole("option")[0];

    expect(option).toBeDefined();
    expect(option?.className).toMatch(/\bmin-h-9\b/);
    expect(option?.className).not.toMatch(/\bh-8\b/);
  });

  it("keeps a touch-sized row on a coarse pointer", async () => {
    const user = userEvent.setup();

    render(<Harness options={STATUS_OPTIONS} initial="todo" />);

    const listbox = await open(user, "Status");
    const option = within(listbox).getAllByRole("option")[0];

    expect(option?.className).toMatch(/coarse-pointer:min-h-touch/);
  });
});

describe("priority options", () => {
  it("renders the badge for every priority, icon included", async () => {
    const user = userEvent.setup();

    const options: SelectOption<string>[] = (
      ["urgent", "high", "normal", "low", "none"] as const
    ).map((priority) => ({
      value: priority,
      label: priority,
      content: <PriorityBadge priority={priority} showLabel />,
    }));

    render(<Harness options={options} initial="high" label="Priority" />);

    const listbox = await open(user, "Priority");

    // Every row carries an icon, so priority is never colour-only here
    // (Requirement 17.7).
    for (const option of within(listbox).getAllByRole("option")) {
      expect(option.querySelector("svg")).not.toBeNull();
    }
  });
});

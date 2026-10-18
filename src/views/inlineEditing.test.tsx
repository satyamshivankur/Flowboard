import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ROLE_CAPABILITIES, type Capability } from "@/config/capabilities";
import { AppProviders } from "@/contexts/AppProviders";
import { useStore } from "@/controllers/store";
import { createSeedState, SEED_IDS } from "@/model/seed";

import { AppShell } from "./AppShell";

/**
 * Editing from the card and the row, without opening the drawer.
 *
 * The thing most likely to break here is the interaction between two click
 * targets occupying the same pixels: the card's own click opens the drawer, and
 * an inline editor's click must not. The card filters events originating from
 * `button` descendants, so every one of these editors has to be a real button
 * — which is also what makes them keyboard reachable (Requirement 15.4, 17.1).
 */

const SEEDED_MEMBER_CAPABILITIES = ROLE_CAPABILITIES.member;

const FIRST = "Define onboarding checklist for new workspaces";
const UNDATED = "Draft the Q3 roadmap outline";

function renderShell() {
  return render(
    <AppProviders>
      <AppShell />
    </AppProviders>,
  );
}

/** The card root, which dnd-kit marks as sortable. */
function card(title: string) {
  return screen.getByRole("button", { name: title });
}

async function waitForBoard() {
  await waitFor(() => {
    expect(card(FIRST)).toBeInTheDocument();
  });
}

async function switchToList(user: ReturnType<typeof userEvent.setup>) {
  const group = await screen.findByRole("radiogroup", { name: "View" });

  await user.click(within(group).getByRole("radio", { name: "List" }));

  return screen.findByRole("table");
}

/** The table row for a task, by its title. */
function row(title: string): HTMLElement {
  const cell = within(screen.getByRole("table")).getByText(title);
  const tr = cell.closest("tr");

  if (tr === null) throw new Error(`No row for ${title}`);

  return tr;
}

function taskByTitle(title: string) {
  return Object.values(useStore.getState().tasks).find(
    (task) => task.title === title,
  );
}

beforeEach(() => {
  useStore.setState((state) => ({
    ...state,
    ...createSeedState(),
    currentUserId: SEED_IDS.users.alice,
    isHydrating: false,
    loadingListId: null,
  }));

  window.localStorage.clear();
});

describe("editing from a board card", () => {
  it("renames the task in place without opening the drawer", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(
      within(card(FIRST)).getByRole("button", { name: "Edit title" }),
    );

    // The drawer must not have opened behind the editor.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const field = screen.getByRole("textbox", { name: "Title" });

    await user.clear(field);
    // Plain Enter commits: a title is not prose, and ⌘/Ctrl+Enter is not
    // discoverable on a card.
    await user.type(field, "Define the onboarding checklist{Enter}");

    await waitFor(() => {
      expect(useStore.getState().tasks["t-001"]?.title).toBe(
        "Define the onboarding checklist",
      );
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("changes priority from the badge", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    // The badge names the field and its current value, so the control is not
    // just a coloured chevron-less blob to a screen reader.
    await user.click(
      within(card(FIRST)).getByRole("button", { name: /^Priority: High/ }),
    );

    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Urgent",
      }),
    );

    await waitFor(() => {
      expect(useStore.getState().tasks["t-001"]?.priority).toBe("urgent");
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  /*
   * `DueDateChip` renders nothing without a date, so an undated task had no
   * target at all. The placeholder is what makes the field reachable.
   */
  it("sets a date on an undated task from the placeholder", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    const target = card(UNDATED);

    expect(taskByTitle(UNDATED)?.dueDate).toBeNull();
    expect(within(target).getByText("Set date")).toBeInTheDocument();

    await user.click(within(target).getByRole("button", { name: "Due date" }));

    const grid = await screen.findByRole("grid");
    const firstDay = grid.querySelector<HTMLElement>("[data-day]");

    expect(firstDay).not.toBeNull();

    await user.click(firstDay as HTMLElement);

    await waitFor(() => {
      expect(taskByTitle(UNDATED)?.dueDate).not.toBeNull();
    });
  });

  it("assigns from the avatar stack", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(
      within(card(FIRST)).getByRole("button", { name: /^Assignees:/ }),
    );

    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Bob Mensah",
      }),
    );

    await waitFor(() => {
      expect(useStore.getState().tasks["t-001"]?.assigneeIds).toContain(
        "u-bob",
      );
    });
  });

  it("offers an Assign placeholder when nobody is assigned", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    // t-003 is seeded unassigned.
    const target = card(UNDATED);

    expect(within(target).getByText("Assign")).toBeInTheDocument();

    await user.click(
      within(target).getByRole("button", { name: "Assignees: Unassigned" }),
    );

    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  /*
   * No status control on a card: the column *is* the status, and a second
   * control for one value would be two sources of truth.
   */
  it("offers no status picker on the board", async () => {
    renderShell();
    await waitForBoard();

    expect(
      within(card(FIRST)).queryByRole("button", { name: /^Status:/ }),
    ).not.toBeInTheDocument();
  });

  it("still opens the drawer when the card body is clicked", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(card(FIRST));

    expect(
      await screen.findByRole("dialog", { name: FIRST }),
    ).toBeInTheDocument();
  });
});

describe("editing from a list row", () => {
  /*
   * The headline request for this view: the pill itself changes the status,
   * with no chevron added to the table.
   */
  it("changes status by clicking the pill", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();
    await switchToList(user);

    const target = row(FIRST);

    await user.click(
      within(target).getByRole("button", { name: "Status: To do" }),
    );

    const menu = await screen.findByRole("menu");

    await user.click(
      within(menu).getByRole("menuitem", { name: "In progress" }),
    );

    await waitFor(() => {
      expect(useStore.getState().tasks["t-001"]?.statusId).toBe("st-bk-active");
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds no dropdown indicator to the status cell", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();
    await switchToList(user);

    const pill = within(row(FIRST)).getByRole("button", {
      name: "Status: To do",
    });

    // The affordance is the hover and focus highlight, not a caret.
    expect(pill.querySelector("svg")).toBeNull();
    expect(pill.className).toMatch(/can-hover:hover:/);
  });

  it("renames, re-prioritises and assigns from the row", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();
    await switchToList(user);

    await user.click(
      within(row(FIRST)).getByRole("button", { name: "Edit title" }),
    );

    const field = screen.getByRole("textbox", { name: "Title" });

    await user.clear(field);
    await user.type(field, "Renamed from the table{Enter}");

    await waitFor(() => {
      expect(useStore.getState().tasks["t-001"]?.title).toBe(
        "Renamed from the table",
      );
    });

    await user.click(
      within(row("Renamed from the table")).getByRole("button", {
        name: /^Priority:/,
      }),
    );
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Low",
      }),
    );

    await waitFor(() => {
      expect(useStore.getState().tasks["t-001"]?.priority).toBe("low");
    });
  });

  it("still opens the drawer when the row is clicked", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();
    await switchToList(user);

    await user.click(within(row(FIRST)).getAllByRole("cell")[1] as HTMLElement);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("a read-only task", () => {
  beforeEach(() => {
    ROLE_CAPABILITIES.member = new Set<Capability>([]);
  });

  afterEach(() => {
    ROLE_CAPABILITIES.member = SEEDED_MEMBER_CAPABILITIES;
  });

  /*
   * A disabled button still swallows the click, and the click a read-only card
   * wants is the one that opens the drawer. So the editors render as plain
   * badges rather than as disabled controls (Requirement 7.10, 15.4).
   */
  it("renders the badges as plain text and still opens the drawer", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));

    await waitFor(() => {
      expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    });

    const target = card(FIRST);

    expect(
      within(target).queryByRole("button", { name: /^Priority:/ }),
    ).not.toBeInTheDocument();
    expect(
      within(target).queryByRole("button", { name: "Edit title" }),
    ).not.toBeInTheDocument();

    // And the card still does the one thing it can do.
    await user.click(target);

    expect(
      await screen.findByRole("dialog", { name: FIRST }),
    ).toBeInTheDocument();
  });
});

/**
 * Creating from the list view.
 *
 * Both affordances were missing entirely. A task could be created here only
 * through the empty state, so the moment a list had one task the board became
 * the only place to add another; and a subtask could be created only from the
 * drawer, even though this table has nested and edited subtasks since it was
 * built (Requirement 5.7, 5.9).
 */
describe("creating from the list view", () => {
  it("creates a task from the toolbar in a list that is not empty", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();
    await switchToList(user);

    /*
     * The precondition, and the whole point: the list is *not* empty, so the
     * empty state is not rendered and its action is not what is being used
     * here. A header row plus at least one task row.
     */
    expect(taskByTitle(FIRST)).toBeDefined();
    expect(
      within(screen.getByRole("table")).getAllByRole("row").length,
    ).toBeGreaterThan(1);
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New task" }));
    await user.type(
      screen.getByRole("textbox", { name: "New task" }),
      "Added from the toolbar{Enter}",
    );

    await waitFor(() => {
      expect(taskByTitle("Added from the toolbar")).toBeDefined();
    });

    const created = taskByTitle("Added from the toolbar");

    /* Top-level, in the selected list, and not a subtask of anything. */
    expect(created?.primaryListId).toBe(SEED_IDS.lists.backlog);
    expect(created?.parentTaskId).toBeNull();

    /* The composer closes and the button comes back, ready for the next one. */
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New task" })).toBeEnabled();
    });
  });

  /*
   * The assertion this feature exists to make pass.
   *
   * Every task in the list is on screen at once, so the create callback has to
   * take the parent's id. A callback bound to one id — the shape the drawer can
   * afford, because it has only one open task — would not error here. It would
   * file the subtask under whichever task the hook captured, which is a silent
   * wrong-parent write rather than a refusal (Requirement 7.4.1.2).
   *
   * So this asserts both halves: the clicked row's task gained it, and another
   * task on screen did not.
   */
  it("files the subtask under the row that was clicked, and no other", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();
    await switchToList(user);

    const parentId = taskByTitle(FIRST)?.id;
    const bystanderId = taskByTitle(UNDATED)?.id;

    expect(parentId).toBeDefined();
    expect(bystanderId).toBeDefined();

    await user.click(
      within(row(FIRST)).getByRole("button", {
        name: `Add subtask to ${FIRST}`,
      }),
    );

    await user.type(
      screen.getByRole("textbox", { name: `New subtask in ${FIRST}` }),
      "Subtask from the row{Enter}",
    );

    await waitFor(() => {
      expect(taskByTitle("Subtask from the row")).toBeDefined();
    });

    const created = taskByTitle("Subtask from the row");

    expect(created?.parentTaskId).toBe(parentId);
    expect(created?.parentTaskId).not.toBe(bystanderId);
    /* A subtask stays in its parent's list (Requirement 2.7). */
    expect(created?.primaryListId).toBe(SEED_IDS.lists.backlog);

    /* Nothing was reparented onto the bystander. */
    expect(
      Object.values(useStore.getState().tasks).filter(
        (task) => task.parentTaskId === bystanderId,
      ),
    ).toHaveLength(0);
  });

  /*
   * Without this the new subtask lands behind a collapsed chevron and the
   * click looks like it did nothing. `onToggleExpand` is a toggle, so the
   * caller has to check before calling it.
   */
  it("reveals the subtask group it just added to", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();
    await switchToList(user);

    await user.click(
      within(row(FIRST)).getByRole("button", {
        name: `Add subtask to ${FIRST}`,
      }),
    );
    await user.type(
      screen.getByRole("textbox", { name: `New subtask in ${FIRST}` }),
      "Revealed subtask{Enter}",
    );

    const disclosure = await screen.findByRole("button", {
      name: `Collapse subtasks of ${FIRST}`,
    });

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(
      within(screen.getByRole("table")).getByText("Revealed subtask"),
    ).toBeInTheDocument();
  });

  /*
   * Depth is capped at `MAX_TASK_DEPTH`, and the Controller refuses a subtask
   * of a subtask. A control whose only outcome is a guaranteed error is worse
   * than no control, which is Requirement 2.13's own reasoning for the three
   * actions a subtask does not offer.
   */
  it("does not offer the control on a subtask row", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();
    await switchToList(user);

    await user.click(
      within(row(FIRST)).getByRole("button", {
        name: `Add subtask to ${FIRST}`,
      }),
    );
    await user.type(
      screen.getByRole("textbox", { name: `New subtask in ${FIRST}` }),
      "Leaf subtask{Enter}",
    );

    await waitFor(() => {
      expect(taskByTitle("Leaf subtask")).toBeDefined();
    });

    /* The row is on screen — the parent auto-expanded — and carries no control. */
    expect(
      within(screen.getByRole("table")).getByText("Leaf subtask"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add subtask to Leaf subtask" }),
    ).not.toBeInTheDocument();
  });

  /*
   * Disabled rather than hidden, with the reason stated once per surface by
   * `ReadOnlyNotice` rather than repeated on every control (Requirement 17.2).
   *
   * No view-only role exists in the seed, so this swaps the policy table —
   * which is the point of keeping authorization in `ROLE_CAPABILITIES`.
   */
  describe("without permission to create", () => {
    beforeEach(() => {
      ROLE_CAPABILITIES.member = new Set<Capability>([]);
    });

    afterEach(() => {
      ROLE_CAPABILITIES.member = SEEDED_MEMBER_CAPABILITIES;
    });

    it("disables both controls", async () => {
      const user = userEvent.setup();

      renderShell();
      await waitForBoard();

      await user.click(screen.getByRole("button", { name: /switch user/i }));
      await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));

      await switchToList(user);

      expect(screen.getByRole("button", { name: "New task" })).toBeDisabled();
      expect(
        within(row(FIRST)).getByRole("button", {
          name: `Add subtask to ${FIRST}`,
        }),
      ).toBeDisabled();
    });
  });
});

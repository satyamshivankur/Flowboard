import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  failNextOperation,
  setSimulationSettings,
  TEST_SIMULATION,
} from "@/adapters/transport/simulated";
import { ROLE_CAPABILITIES, type Capability } from "@/config/capabilities";
import { AppProviders } from "@/contexts/AppProviders";
import { useStore } from "@/controllers/store";
import { createSeedState, SEED_IDS } from "@/model/seed";

import { AppShell } from "./AppShell";

/**
 * The views, end to end.
 *
 * `AppShell.test.tsx` covers the chrome and the permission demo; this file
 * covers what the content region does — the board, the list and the drawer —
 * against the real store, so a regression in a selector, a hook or a view all
 * surface here (Requirement 18.7).
 */

/** The real policy, captured before any test swaps it out. */
const SEEDED_MEMBER_CAPABILITIES = ROLE_CAPABILITIES.member;

const BACKLOG = {
  /** "To do", in board order. */
  first: "Define onboarding checklist for new workspaces",
  second: "Audit empty states across the product",
  third: "Draft the Q3 roadmap outline",
  /** The only `high` task in the list, and the only `none`. */
  highest: "Define onboarding checklist for new workspaces",
  lowest: "Draft the Q3 roadmap outline",
} as const;

function renderShell() {
  return render(
    <AppProviders>
      <AppShell />
    </AppProviders>,
  );
}

/** A card in the board, which dnd-kit exposes as a button named by its title. */
function card(title: string) {
  return screen.getByRole("button", { name: title });
}

/**
 * The floating clone that follows the pointer, or `null` when no drag is live.
 *
 * dnd-kit renders it into a container of its own marked `data-dnd-overlay`,
 * which is the only reliable way to tell the clone apart from the real card —
 * they carry the same label by design.
 */
function overlayCard(): Element | null {
  /*
   * Queried by label rather than taken as the overlay's first child: the card
   * root is now a sortable wrapper that also holds any expanded subtasks, so
   * the labelled card is nested one level in. Asking for the label is what we
   * actually mean, and it does not care about the wrapper's existence.
   */
  return (
    document.querySelector("[data-dnd-overlay] [aria-label]") ??
    document.querySelector("[data-dnd-overlay]")?.firstElementChild ??
    null
  );
}

async function waitForBoard() {
  await waitFor(() => {
    expect(card(BACKLOG.first)).toBeInTheDocument();
  });
}

/** Navigates to Sprint 14, the seeded list holding a task with subtasks. */
async function selectSprint14(user: ReturnType<typeof userEvent.setup>) {
  const tree = screen.getByRole("tree", { name: "Workspace" });

  for (const item of within(tree).queryAllByRole("treeitem", {
    expanded: false,
  })) {
    const toggle = item.querySelector("button");

    if (toggle) await user.click(toggle);
  }

  await user.click(within(tree).getByText("Sprint 14"));
}

/** Opens a card's overflow menu and returns it. */
async function openMenuFor(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
) {
  await user.click(screen.getByLabelText(`Actions for ${title}`));

  return screen.findByRole("menu");
}

async function switchToList(user: ReturnType<typeof userEvent.setup>) {
  const group = await screen.findByRole("radiogroup", { name: "View" });

  await user.click(within(group).getByRole("radio", { name: "List" }));

  return screen.findByRole("table");
}

/**
 * The drawer's click-to-edit fields render as a button until focused, so the
 * value is text content rather than an input value.
 */
function inlineField(drawer: HTMLElement, label: string) {
  return within(drawer).getByRole("button", { name: `Edit ${label}` });
}

/** Everything dnd-kit has announced, across however many live regions exist. */
function announcements() {
  return screen
    .getAllByRole("status")
    .map((region) => region.textContent)
    .join(" ");
}

/** Row titles in render order, ignoring the checkbox and chevron cells. */
function rowTitles(table: HTMLElement): string[] {
  return (
    within(table)
      .getAllByRole("row")
      // The first row is the header, which has `columnheader` cells, not `cell`.
      .slice(1)
      .map(
        (row) => within(row).getAllByRole("cell")[0]?.textContent.trim() ?? "",
      )
  );
}

beforeEach(() => {
  // The store is a module singleton, so every test restates the seed.
  useStore.setState((state) => ({
    ...state,
    ...createSeedState(),
    currentUserId: SEED_IDS.users.alice,
    isHydrating: false,
    loadingListId: null,
  }));

  window.localStorage.clear();
});

describe("board", () => {
  it("renders a column per status with its task count", async () => {
    renderShell();
    await waitForBoard();

    const todo = screen.getByRole("region", { name: "To do" });

    expect(within(todo).getByText("3")).toBeInTheDocument();
    expect(
      within(todo).getByRole("button", { name: BACKLOG.second }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("region", { name: "In progress" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Done" })).toBeInTheDocument();
  });

  it("creates a task into the column that was asked for", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    const done = screen.getByRole("region", { name: "Done" });

    await user.click(
      within(done).getByRole("button", { name: "Add task to Done" }),
    );

    const input = within(done).getByRole("textbox", {
      name: "New task in Done",
    });

    await user.type(input, "Write the release note{Enter}");

    await waitFor(() => {
      expect(
        within(done).getByRole("button", { name: "Write the release note" }),
      ).toBeInTheDocument();
    });
  });

  /*
   * The card binds its own `onKeyDown` for Enter alongside dnd-kit's keyboard
   * sensor, and a drag that cannot be started from the keyboard fails
   * silently — the card goes on advertising itself as draggable. This asserts
   * the activator still runs (Requirement 4.11, 17.5).
   */
  it("starts a keyboard drag on Space and announces it", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    card(BACKLOG.first).focus();
    await user.keyboard("[Space]");

    /*
     * dnd-kit renders the floating clone into its own `[data-dnd-overlay]`
     * container, and only while an operation is live — so the clone appearing
     * there, labelled with this task, means the keyboard activator fired.
     *
     * Not `getAllByRole("button")` counting two matches, which is how this was
     * written against dnd-kit 6: the clone is rendered with registration
     * stubbed out, so the accessibility plugin never gives it the `role` the
     * real card has. Counting roles would have passed for the wrong reason.
     */
    await waitFor(() => {
      expect(overlayCard()).toHaveAttribute("aria-label", BACKLOG.first);
    });

    expect(announcements()).toMatch(/picked up|is over/i);

    // And Escape puts it back without writing anything.
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(announcements()).toMatch(/cancelled/i);
    });

    await waitFor(() => {
      expect(overlayCard()).toBeNull();
    });
  });

  /*
   * Subtasks on the board, which until recently were a number and nothing
   * else: the card showed "1/2" and the only way to see or change a subtask
   * was the drawer. The list view's table has always nested and edited them in
   * place, so this asserts the board now does the same (Requirement 5.7,
   * 15.10).
   */
  it("reveals and edits subtasks under their parent card", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await selectSprint14(user);

    // The count chip is the disclosure, and starts collapsed.
    const disclosure = await waitFor(() =>
      screen.getByRole("button", { name: /^Expand subtasks of/ }),
    );

    const parentTitle = /^Expand subtasks of (.+)$/.exec(
      disclosure.getAttribute("aria-label") ?? "",
    )?.[1];

    expect(parentTitle).toBeDefined();
    expect(disclosure).toHaveTextContent("1/2");

    const subtaskTitle =
      useStore.getState().tasks["t-009-b"]?.title ?? "missing";

    expect(screen.queryByLabelText(subtaskTitle)).not.toBeInTheDocument();

    await user.click(disclosure);

    // Revealed, and carrying the parent's controls rather than a summary.
    const subtask = await waitFor(() => screen.getByLabelText(subtaskTitle));

    for (const label of [
      `Mark "${subtaskTitle}" complete`,
      `Actions for ${subtaskTitle}`,
    ]) {
      expect(within(subtask).getByLabelText(label)).toBeInTheDocument();
    }

    /*
     * The three the Controller refuses for a subtask: `moveToList` rejects it
     * outright, and `move` has no column position to reorder it within. A
     * menu offering them would be offering a guaranteed error.
     */
    const menu = await openMenuFor(user, subtaskTitle);

    expect(
      within(menu).getByRole("menuitem", { name: "Delete subtask" }),
    ).toBeInTheDocument();

    for (const name of [/^Move up/, /^Move down/, /^Duplicate/, /^Move to "/]) {
      expect(
        within(menu).queryByRole("menuitem", { name }),
      ).not.toBeInTheDocument();
    }

    await user.keyboard("{Escape}");

    // And an edit on a subtask writes through to the subtask, not the parent.
    await user.click(
      within(subtask).getByLabelText(`Mark "${subtaskTitle}" complete`),
    );

    await waitFor(() => {
      const statusId = useStore.getState().tasks["t-009-b"]?.statusId ?? "";

      expect(useStore.getState().statuses[statusId]?.category).toBe("done");
    });

    // The badge counts the children it now renders, so the two agree.
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: `Collapse subtasks of ${String(parentTitle)}`,
        }),
      ).toHaveTextContent("2/2");
    });
  });
});

describe("opening a task", () => {
  it("opens the drawer on a card click, with the task's details", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(card(BACKLOG.first));

    const drawer = await screen.findByRole("dialog", { name: BACKLOG.first });

    expect(inlineField(drawer, "title")).toHaveTextContent(BACKLOG.first);
    // The path, so the drawer says where the task lives (Requirement 7.4).
    expect(
      within(drawer).getByRole("navigation", { name: "Task path" }),
    ).toHaveTextContent("Engineering");
  });

  /*
   * Clicking a control inside the card must not also open the drawer — the
   * card's click handler filters interactive descendants rather than relying on
   * every child remembering to stop propagation (Requirement 15.4).
   */
  it("does not open the drawer when a card control is used", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(
      screen.getByRole("checkbox", {
        name: `Mark "${BACKLOG.first}" complete`,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", {
          name: `Mark "${BACKLOG.first}" complete`,
        }),
      ).toBeChecked();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the card that opened it", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    const opener = card(BACKLOG.first);

    await user.click(opener);
    await screen.findByRole("dialog", { name: BACKLOG.first });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Focus restoration is what makes the drawer usable from the keyboard: it
    // must land back on the card, not at the top of the document
    // (Requirement 7.3, 17.2).
    await waitFor(() => {
      expect(card(BACKLOG.first)).toHaveFocus();
    });
  });

  /*
   * Previous/next walks the current view's order, which is why the shell hands
   * the drawer `orderedTaskIds` rather than letting it guess
   * (Requirement 7.11).
   */
  it("walks to the previous and next task without closing", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(card(BACKLOG.second));
    await screen.findByRole("dialog", { name: BACKLOG.second });

    await user.click(screen.getByRole("button", { name: "Next task" }));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: BACKLOG.third }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Previous task" }));
    await user.click(screen.getByRole("button", { name: "Previous task" }));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: BACKLOG.first }),
      ).toBeInTheDocument();
    });

    // At the start of the order there is nowhere further back to go.
    expect(
      screen.getByRole("button", { name: "Previous task" }),
    ).toBeDisabled();
  });

  it("saves a title edit from the drawer back to the board", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(card(BACKLOG.third));

    const drawer = await screen.findByRole("dialog", { name: BACKLOG.third });

    await user.click(inlineField(drawer, "title"));

    const title = within(drawer).getByRole("textbox", { name: "Title" });

    await user.clear(title);
    await user.type(title, "Draft the Q4 roadmap outline");
    // Cmd/Ctrl+Enter commits; plain Enter inserts a newline (Requirement 7.5).
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(inlineField(drawer, "title")).toHaveTextContent(
        "Draft the Q4 roadmap outline",
      );
    });

    /*
     * The board can only be queried once the drawer is closed: Headless UI
     * hides the rest of the document from the accessibility tree while a modal
     * is open, which is exactly what it should do.
     */
    await user.click(within(drawer).getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Draft the Q4 roadmap outline" }),
      ).toBeInTheDocument();
    });
  });
});

describe("list view", () => {
  it("sorts by due date ascending by default, with undated tasks last", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    const table = await switchToList(user);

    expect(
      within(table).getByRole("columnheader", { name: /^Due/ }),
    ).toHaveAttribute("aria-sort", "ascending");

    const titles = rowTitles(table);

    // Seeded five days overdue, so it sorts first in ascending order.
    expect(titles[0]).toContain("Agree the colour token naming scheme");
    // The two undated tasks sort last regardless of direction (Req 5.4).
    expect(titles.slice(-2)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(BACKLOG.second),
        expect.stringContaining(BACKLOG.third),
      ]),
    );
  });

  it("sorts by priority and flips direction on a second click", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    const table = await switchToList(user);
    const priority = within(table).getByRole("columnheader", {
      name: /^Priority/,
    });

    await user.click(within(priority).getByRole("button"));

    await waitFor(() => {
      expect(
        within(screen.getByRole("table")).getByRole("columnheader", {
          name: /^Priority/,
        }),
      ).toHaveAttribute("aria-sort", "ascending");
    });

    // Ascending priority is highest-first, because the comparator reads
    // `PRIORITY_CONFIG[p].rank` rather than the string (Requirement 5.3).
    expect(rowTitles(screen.getByRole("table"))[0]).toContain(BACKLOG.highest);

    await user.click(
      within(
        within(screen.getByRole("table")).getByRole("columnheader", {
          name: /^Priority/,
        }),
      ).getByRole("button"),
    );

    await waitFor(() => {
      expect(
        within(screen.getByRole("table")).getByRole("columnheader", {
          name: /^Priority/,
        }),
      ).toHaveAttribute("aria-sort", "descending");
    });

    expect(rowTitles(screen.getByRole("table"))[0]).toContain(BACKLOG.lowest);
  });

  /*
   * Subtasks nest under their parent rather than appearing as top-level rows,
   * and they are hidden until the parent is expanded (Requirement 5.7).
   */
  it("reveals subtasks under their parent row on disclosure", async () => {
    const user = userEvent.setup();

    useStore.setState((state) => ({ ...state, selectedListId: null }));

    renderShell();
    await waitForBoard();

    // Sprint 14 holds the seeded parent task with two subtasks.
    const tree = screen.getByRole("tree", { name: "Workspace" });

    for (const item of within(tree).queryAllByRole("treeitem", {
      expanded: false,
    })) {
      const toggle = item.querySelector("button");

      if (toggle) await user.click(toggle);
    }

    await user.click(within(tree).getByText("Sprint 14"));

    const table = await switchToList(user);

    const disclosure = await waitFor(() =>
      within(table).getByRole("button", { name: /^Expand subtasks of/ }),
    );
    const parentTitle = /Expand subtasks of (.+)$/.exec(
      disclosure.getAttribute("aria-label") ?? "",
    )?.[1];

    expect(parentTitle).toBeDefined();

    const before = rowTitles(screen.getByRole("table")).length;

    await user.click(disclosure);

    await waitFor(() => {
      expect(rowTitles(screen.getByRole("table")).length).toBeGreaterThan(
        before,
      );
    });

    expect(
      within(screen.getByRole("table")).getByRole("button", {
        name: `Collapse subtasks of ${String(parentTitle)}`,
      }),
    ).toBeInTheDocument();
  });

  it("opens the drawer from a table row", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    const table = await switchToList(user);
    const row = within(table).getAllByRole("row")[1];

    expect(row).toBeDefined();

    await user.click(row as HTMLElement);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("a read-only task", () => {
  /*
   * There is no view-only role in the seed, so this swaps the policy table for
   * one whose `member` role may see tasks but not edit them. That is the point
   * of keeping authorization in `ROLE_CAPABILITIES`: a new role is a table
   * entry, and the UI follows it with no changes of its own
   * (Requirement 8.6, 21.7).
   */
  beforeEach(() => {
    ROLE_CAPABILITIES.member = new Set<Capability>([]);
  });

  afterEach(() => {
    ROLE_CAPABILITIES.member = SEEDED_MEMBER_CAPABILITIES;
  });

  it("renders the drawer read-only and says why", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /switch user/i }),
      ).toHaveTextContent("Member");
    });

    await user.click(card(BACKLOG.first));

    const drawer = await screen.findByRole("dialog", { name: BACKLOG.first });

    expect(within(drawer).getByText(/read-only/i)).toHaveTextContent(
      /admins only/i,
    );
    expect(
      within(drawer).getByRole("button", { name: /delete/i }),
    ).toBeDisabled();
    /*
     * The title renders as plain text, not a disabled button. A disabled
     * button still absorbs the click, and on a card or a row that is the click
     * that opens the drawer — so read-only inline fields stopped being
     * buttons at all (Requirement 7.10, 15.4).
     */
    expect(
      within(drawer).queryByRole("button", { name: "Edit title" }),
    ).not.toBeInTheDocument();
    expect(drawer).toHaveTextContent(BACKLOG.first);
  });

  /*
   * The move control is disabled outright rather than opening onto an empty
   * menu — the same decision the rest of the drawer makes (Requirement 7.10).
   */
  it("disables the move-to-list control", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /switch user/i }),
      ).toHaveTextContent("Member");
    });

    await user.click(card(BACKLOG.first));

    const drawer = await screen.findByRole("dialog", { name: BACKLOG.first });

    expect(
      within(drawer).getByRole("button", { name: "Move to list" }),
    ).toBeDisabled();
  });

  it("disables the board's own quick actions too", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", {
          name: `Mark "${BACKLOG.first}" complete`,
        }),
      ).toBeDisabled();
    });

    expect(
      screen.getByRole("button", { name: "Add task to To do" }),
    ).toBeDisabled();
  });
});

describe("card quick actions", () => {
  /** Opens a card's overflow menu and returns its items. */
  async function openCardMenu(
    user: ReturnType<typeof userEvent.setup>,
    title: string,
  ) {
    await user.click(
      screen.getByRole("button", { name: `Actions for ${title}` }),
    );

    return screen.findByRole("menu");
  }

  /*
   * Every quick action also exists in the drawer, but the reverse must hold
   * too: triaging a column should not require opening the drawer six times
   * (Requirement 15.2, 15.10).
   */
  it("assigns a member without opening the drawer", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    const menu = await openCardMenu(user, BACKLOG.third);

    await user.click(
      within(menu).getByRole("menuitem", { name: "Assign Bob Mensah" }),
    );

    await waitFor(() => {
      expect(useStore.getState().tasks["t-003"]?.assigneeIds).toContain(
        "u-bob",
      );
    });

    // And the same item now offers the inverse.
    const reopened = await openCardMenu(user, BACKLOG.third);

    expect(
      within(reopened).getByRole("menuitem", { name: "Unassign Bob Mensah" }),
    ).toBeInTheDocument();
  });

  it("sets and clears a due date from the menu", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    // t-003 is seeded without a due date, so "clear" should be absent at first.
    const menu = await openCardMenu(user, BACKLOG.third);

    expect(
      within(menu).queryByRole("menuitem", { name: "Clear due date" }),
    ).not.toBeInTheDocument();

    await user.click(
      within(menu).getByRole("menuitem", { name: "Due tomorrow" }),
    );

    await waitFor(() => {
      expect(useStore.getState().tasks["t-003"]?.dueDate).not.toBeNull();
    });

    const reopened = await openCardMenu(user, BACKLOG.third);

    await user.click(
      within(reopened).getByRole("menuitem", { name: "Clear due date" }),
    );

    await waitFor(() => {
      expect(useStore.getState().tasks["t-003"]?.dueDate).toBeNull();
    });
  });

  /*
   * Reordering has to work without a drag: a long-press drag is awkward on a
   * phone and unavailable to some assistive technology (Requirement 20.8).
   */
  it("reorders within a column from the menu, with the ends disabled", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    const first = await openCardMenu(user, BACKLOG.first);

    // The top card cannot move up.
    expect(
      within(first).getByRole("menuitem", { name: "Move up" }),
    ).toBeDisabled();

    await user.click(
      within(first).getByRole("menuitem", { name: "Move down" }),
    );

    await waitFor(() => {
      const todo = screen.getByRole("region", { name: "To do" });
      // The card roots, not every button inside them — the cards carry inline
      // editors now, which are buttons of their own.
      const titles = [
        ...todo.querySelectorAll('[aria-roledescription="draggable"]'),
      ].map((card) => card.getAttribute("aria-label"));

      // The first card now sits after the one that used to follow it.
      expect(titles.indexOf(BACKLOG.second)).toBeLessThan(
        titles.indexOf(BACKLOG.first),
      );
    });
  });
});

describe("failed mutations", () => {
  /*
   * The dev panel's "fail the next operation" switch is only worth having if a
   * failure is visible. Arming the real transport here, rather than mocking,
   * means this covers the same path a reviewer exercises by hand
   * (Requirement 9.7, 14.4, 14.12).
   */
  it("surfaces a toast with a retry when a quick update is rejected", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    failNextOperation();

    await user.click(
      screen.getByRole("checkbox", {
        name: `Mark "${BACKLOG.first}" complete`,
      }),
    );

    /*
     * The visible toast carries no `role`: announcements come from a dedicated
     * live region in `ToastProvider`, so screen-reader output does not depend
     * on the visual stack being mounted (Requirement 17.6). The assertion
     * therefore goes through the text a user actually reads.
     */
    expect(await screen.findByText("Connection problem")).toBeInTheDocument();
    // Twice over: once in the visible toast, once in the live region that
    // announces it independently of the visual stack.
    expect(
      screen.getAllByText(/network request failed/i).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();

    // A rejected mutation leaves the Model untouched (Requirement 9.10).
    expect(useStore.getState().tasks["t-001"]?.statusId).toBe("st-bk-todo");
  });

  it("leaves the board unchanged when a reorder is rejected", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    const before = useStore.getState().tasks["t-001"]?.position;

    failNextOperation();

    await user.click(
      screen.getByRole("button", { name: `Actions for ${BACKLOG.first}` }),
    );
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Move down",
      }),
    );

    await screen.findByText("Connection problem");

    expect(useStore.getState().tasks["t-001"]?.position).toBe(before);
  });
});

describe("board paging on a phone", () => {
  /*
   * One column fills the viewport below `md`, so without a pager there is
   * nothing to say that two more columns exist (Requirement 4.10, 20.5).
   */
  it("offers a dot per column, marking the current one", async () => {
    renderShell();
    await waitForBoard();

    const pager = screen.getByRole("navigation", { name: "Board columns" });

    expect(within(pager).getAllByRole("button")).toHaveLength(3);
    expect(
      within(pager).getByRole("button", { name: "Go to To do" }),
    ).toHaveAttribute("aria-current", "true");
    expect(pager).toHaveTextContent("1 of 3");
  });
});

describe("an empty list", () => {
  it("offers the create action in place, rather than pointing at the board", async () => {
    const user = userEvent.setup();

    // Clear the backlog so the list view has nothing to show.
    useStore.setState((state) => ({ ...state, tasks: {} }));

    renderShell();

    const group = await screen.findByRole("radiogroup", { name: "View" });

    await user.click(within(group).getByRole("radio", { name: "List" }));

    await user.click(await screen.findByRole("button", { name: /new task/i }));

    await user.type(
      screen.getByRole("textbox", { name: "New task" }),
      "Plan the migration{Enter}",
    );

    await waitFor(() => {
      expect(screen.getByRole("table")).toHaveTextContent("Plan the migration");
    });
  });
});

describe("permission UX", () => {
  /*
   * A drawer left open on a task the new user cannot see would be showing them
   * data they are not entitled to. The view-model resolves to "does not exist"
   * for them, which collapses the drawer in the same commit as the switch
   * (Requirement 8.13, 17.1).
   */
  it("closes a drawer open on a task the new user cannot see", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(card(BACKLOG.first));
    await screen.findByRole("dialog", { name: BACKLOG.first });

    // Bob can see Backlog, so pick a task he cannot: one on the denied Infra
    // list, reached by selecting it as Alice first.
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const tree = screen.getByRole("tree", { name: "Workspace" });

    for (let pass = 0; pass < 3; pass += 1) {
      const collapsed = within(tree).queryAllByRole("treeitem", {
        expanded: false,
      });

      if (collapsed.length === 0) break;

      for (const item of collapsed) {
        const toggle = item.querySelector("button");

        if (toggle) await user.click(toggle);
      }
    }

    await user.click(within(tree).getByText("Infra"));

    /*
     * Read the title out of the store rather than restating a seed string, so
     * this does not break the next time the fixture is reworded.
     */
    const infraTask = Object.values(useStore.getState().tasks).find(
      (task) => task.primaryListId === SEED_IDS.lists.infra,
    );

    expect(infraTask).toBeDefined();

    const infraCard = await waitFor(() =>
      screen.getByRole("button", { name: infraTask?.title ?? "" }),
    );

    await user.click(infraCard);
    await screen.findByRole("dialog");

    /*
     * The switch goes through the store rather than the switcher, and
     * deliberately: the drawer is modal, so Headless UI hides the top bar from
     * the accessibility tree while it is open and the control genuinely cannot
     * be reached. The guard still has to hold — this is the defence against a
     * switch arriving from anywhere other than that one button, including a
     * future command palette or a restored session.
     */
    act(() => {
      useStore.getState().actions.session.switchUser(SEED_IDS.users.bob);
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // And the content region explains the situation rather than going blank.
    expect(await screen.findByText(/don't have access/i)).toBeInTheDocument();
  });

  /*
   * A permission denial and a network failure read differently on purpose: one
   * is a dead end, the other is worth retrying, and a single "Something went
   * wrong" makes both useless (Requirement 14.5, 17.3).
   */
  it("words a network failure as retryable and a denial as not", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    failNextOperation();

    await user.click(
      screen.getByRole("checkbox", {
        name: `Mark "${BACKLOG.first}" complete`,
      }),
    );

    expect(await screen.findByText("Connection problem")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();

    // Now a denial: Bob cannot archive, and the pipeline refuses rather than
    // the UI merely disabling the control.
    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));

    const result = useStore
      .getState()
      .actions.container.archive(
        { workspaceId: SEED_IDS.workspace, userId: SEED_IDS.users.bob },
        SEED_IDS.spaces.engineering,
      );

    await expect(result).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  /*
   * The reason sits on the surface, once, rather than on every disabled
   * control — and as visible text, which `title` cannot be on a touch device
   * (Requirement 8.11, 17.2, 20.10).
   */
  it("states on the board itself why a list is read-only", async () => {
    const user = userEvent.setup();

    ROLE_CAPABILITIES.member = new Set<Capability>([]);

    try {
      renderShell();
      await waitForBoard();

      await user.click(screen.getByRole("button", { name: /switch user/i }));
      await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));

      await waitFor(() => {
        expect(screen.getByText(/read-only/i)).toHaveTextContent(
          /admins only/i,
        );
      });

      // And it is gone again for someone who can edit.
      await user.click(screen.getByRole("button", { name: /switch user/i }));
      await user.click(screen.getByRole("menuitem", { name: /Alice/ }));

      await waitFor(() => {
        expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument();
      });
    } finally {
      ROLE_CAPABILITIES.member = SEEDED_MEMBER_CAPABILITIES;
    }
  });
});

describe("destructive actions", () => {
  /*
   * Deleting a subtask was the one destructive path going through unconfirmed
   * (Requirement 14.9, 2.12).
   */
  it("confirms before deleting a subtask, and does nothing if declined", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    // t-009 is the seeded task that has subtasks; it lives in Sprint 14.
    useStore.setState((state) => ({ ...state }));

    const tree = screen.getByRole("tree", { name: "Workspace" });

    for (let pass = 0; pass < 3; pass += 1) {
      const collapsed = within(tree).queryAllByRole("treeitem", {
        expanded: false,
      });

      if (collapsed.length === 0) break;

      for (const item of collapsed) {
        const toggle = item.querySelector("button");

        if (toggle) await user.click(toggle);
      }
    }

    await user.click(within(tree).getByText("Sprint 14"));

    const parent = await waitFor(() =>
      screen.getByRole("button", {
        name: useStore.getState().tasks["t-009"]?.title ?? "",
      }),
    );

    await user.click(parent);

    const drawer = await screen.findByRole("dialog");
    const subtaskTitle = useStore.getState().tasks["t-009-a"]?.title ?? "";

    expect(subtaskTitle.length).toBeGreaterThan(0);

    await user.click(
      within(drawer).getByRole("button", { name: `Delete "${subtaskTitle}"` }),
    );

    // Declining must leave it exactly where it was.
    const cancel = await screen.findByRole("button", { name: /cancel/i });

    await user.click(cancel);

    expect(useStore.getState().tasks["t-009-a"]).toBeDefined();

    await user.click(
      within(drawer).getByRole("button", { name: `Delete "${subtaskTitle}"` }),
    );
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(useStore.getState().tasks["t-009-a"]).toBeUndefined();
    });
  });
});

describe("pending states", () => {
  /*
   * Latency is pinned to zero for the suite, so a test that wants to observe
   * the in-flight state has to put some back. 60ms is enough to assert on and
   * short enough not to slow the run.
   */
  afterEach(() => {
    setSimulationSettings(TEST_SIMULATION);
  });

  it("subdues only the card being saved, and clears afterwards", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    setSimulationSettings({ minLatencyMs: 60, maxLatencyMs: 60 });

    await user.click(
      screen.getByRole("checkbox", {
        name: `Mark "${BACKLOG.first}" complete`,
      }),
    );

    /*
     * `aria-busy` rather than the opacity class: the visual cue says nothing
     * to a screen reader, so the attribute is the part worth asserting
     * (Requirement 14.7).
     */
    await waitFor(() => {
      expect(card(BACKLOG.first)).toHaveAttribute("aria-busy", "true");
    });

    // Point-of-interaction, not global: the neighbouring card is untouched.
    expect(card(BACKLOG.second)).not.toHaveAttribute("aria-busy");

    await waitFor(() => {
      expect(card(BACKLOG.first)).not.toHaveAttribute("aria-busy");
    });
  });
});

describe("the off-canvas sidebar", () => {
  /*
   * Below `lg` the sidebar is a Headless UI `Dialog`, which has to behave like
   * one: trapped focus, Escape to close, focus restored to the trigger
   * (Requirement 17.2, 20.4, 20.7).
   *
   * This is the one breakpoint the app observes from JavaScript, so the test
   * overrides `matchMedia` rather than resizing anything — `SidebarContext`
   * reads exactly this query.
   */
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string): MediaQueryList =>
        ({
          // Narrow: the `lg` min-width query must not match.
          matches:
            !query.includes("min-width") &&
            (query.includes("hover: hover") || query.includes("pointer: fine")),
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    });
  });

  it("opens as a dialog, closes on Escape and restores focus to its trigger", async () => {
    const user = userEvent.setup();

    renderShell();

    const trigger = await screen.findByRole("button", {
      name: /navigation|sidebar|menu/i,
    });

    // Closed to begin with: the tree is not merely off-screen, it is absent.
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();

    await user.click(trigger);

    const sheet = await screen.findByRole("dialog");

    expect(within(sheet).getByRole("tree")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /navigation|sidebar|menu/i }),
      ).toHaveFocus();
    });
  });
});

describe("the drawer's property pickers", () => {
  /*
   * The reported bug, at the level it was reported: the status dropdown showed
   * a pill on its closed trigger and plain text once opened, because the
   * drawer supplied `renderValue` and not `renderOption`. Both halves are
   * asserted here so the asymmetry cannot come back.
   */
  async function openDrawer(user: ReturnType<typeof userEvent.setup>) {
    renderShell();
    await waitForBoard();

    await user.click(card(BACKLOG.first));

    return screen.findByRole("dialog", { name: BACKLOG.first });
  }

  it("renders the status pill on the trigger and in every option", async () => {
    const user = userEvent.setup();
    const drawer = await openDrawer(user);

    const trigger = within(drawer).getByRole("button", { name: "Status" });

    expect(trigger.querySelector("[data-status-dot]")).not.toBeNull();

    await user.click(trigger);

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");

    expect(options.length).toBeGreaterThan(1);

    for (const option of options) {
      expect(option.querySelector("[data-status-dot]")).not.toBeNull();
    }
  });

  /*
   * `PRIORITY_CONFIG` has carried an icon and a colour token since Phase 0.
   * The picker whose entire job is choosing a priority was rendering neither.
   */
  it("renders the priority badge on the trigger and in every option", async () => {
    const user = userEvent.setup();
    const drawer = await openDrawer(user);

    const trigger = within(drawer).getByRole("button", { name: "Priority" });

    expect(trigger.querySelector("svg")).not.toBeNull();

    await user.click(trigger);

    const listbox = await screen.findByRole("listbox");

    for (const option of within(listbox).getAllByRole("option")) {
      // The icon is what keeps priority from being colour-only
      // (Requirement 17.7).
      expect(option.querySelector("svg")).not.toBeNull();
    }
  });

  it("shows an avatar per member in the assignee menu, with a real checked state", async () => {
    const user = userEvent.setup();
    const drawer = await openDrawer(user);

    // The name comes from the `Menu`'s `label`, which merges onto the trigger.
    await user.click(within(drawer).getByRole("button", { name: "Assignees" }));

    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");

    expect(items.length).toBeGreaterThan(1);

    for (const item of items) {
      // Avatars render initials, so each row carries more than a bare name.
      expect(item.textContent).not.toBe("");
    }

    /*
     * Alice is seeded as the assignee of this task. The state used to live
     * inside the label as a "✓" character, which a screen reader reads out as
     * a tick glyph; it is now part of the accessible name.
     */
    expect(
      within(menu).getByRole("menuitem", { name: /Alice Nguyen, selected/ }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Bob Mensah" }),
    ).toBeInTheDocument();

    // And toggling works through the new shape.
    await user.click(
      within(menu).getByRole("menuitem", { name: "Bob Mensah" }),
    );

    await waitFor(() => {
      expect(useStore.getState().tasks["t-001"]?.assigneeIds).toContain(
        "u-bob",
      );
    });
  });

  it("shows the status dot in the card's quick-change menu too", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    await user.click(
      screen.getByRole("button", { name: `Actions for ${BACKLOG.first}` }),
    );

    const menu = await screen.findByRole("menu");
    const statusItems = within(menu)
      .getAllByRole("menuitem")
      .filter((item) => item.textContent.startsWith("Move to"))
      // `Move to "Sprint 14"` is a list move, not a status change.
      .filter((item) => !item.textContent.includes('"'));

    expect(statusItems.length).toBeGreaterThan(0);

    for (const item of statusItems) {
      expect(item.querySelector("[data-status-dot]")).not.toBeNull();
    }
  });
});

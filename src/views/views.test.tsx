import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { failNextOperation } from "@/adapters/transport/simulated";
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

async function waitForBoard() {
  await waitFor(() => {
    expect(card(BACKLOG.first)).toBeInTheDocument();
  });
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
   * The card spreads dnd-kit's `listeners` and then sets its own `onKeyDown`.
   * That ordering replaces dnd-kit's keyboard activator unless the handler
   * composes, and the failure is silent — the card keeps claiming to be
   * sortable. This asserts the activator still runs (Requirement 4.11, 17.5).
   */
  it("starts a keyboard drag on Space and announces it", async () => {
    const user = userEvent.setup();

    renderShell();
    await waitForBoard();

    card(BACKLOG.first).focus();
    await user.keyboard("[Space]");

    /*
     * The drag overlay is a second clone of the card carrying the same label,
     * so two matches means the keyboard activator fired and a drag is live.
     */
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: BACKLOG.first }),
      ).toHaveLength(2);
    });

    expect(announcements()).toMatch(/picked up task|moved over/i);

    // And Escape puts it back without writing anything.
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(announcements()).toMatch(/cancelled/i);
    });

    expect(screen.getAllByRole("button", { name: BACKLOG.first })).toHaveLength(
      1,
    );
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
  const original = ROLE_CAPABILITIES.member;

  beforeEach(() => {
    ROLE_CAPABILITIES.member = new Set<Capability>([]);
  });

  afterEach(() => {
    ROLE_CAPABILITIES.member = original;
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
    expect(inlineField(drawer, "title")).toBeDisabled();
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
      const titles = within(todo)
        .getAllByRole("button")
        .map((element) => element.getAttribute("aria-label"));

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

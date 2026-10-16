import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/contexts/AppProviders";
import { useStore } from "@/controllers/store";
import { createSeedState, SEED_IDS } from "@/model/seed";

import { AppShell } from "../AppShell";

/**
 * Task search, end to end.
 *
 * The behaviour worth protecting is the permission scoping: a search box that
 * matches on titles is the easiest way to leak the name of something a user
 * cannot open, and no amount of UI care fixes it if the query is unscoped
 * (Requirement 8.8, 23.2).
 */

function renderShell() {
  return render(
    <AppProviders>
      <AppShell />
    </AppProviders>,
  );
}

function palette() {
  return screen.getByRole("dialog");
}

async function openSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /search/i }));

  return screen.findByRole("combobox", { name: "Search tasks" });
}

/**
 * The visible option labels, which is what a user is choosing between.
 *
 * `queryAllByRole`, not `getAllByRole`: the latter throws on an empty result
 * rather than returning one, so "there are no options" could never be asserted
 * with it.
 */
function optionTitles() {
  return screen
    .queryAllByRole("option")
    .map((option) => option.textContent);
}

async function switchTo(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
) {
  await user.click(screen.getByRole("button", { name: /switch user/i }));
  await user.click(screen.getByRole("menuitem", { name }));
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

describe("opening the palette", () => {
  it("opens from the top bar and starts with a hint rather than results", async () => {
    const user = userEvent.setup();

    renderShell();

    const input = await openSearch(user);

    expect(input).toHaveFocus();
    expect(
      within(palette()).getByText(/search every task you can see/i),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("opens on the keyboard shortcut from anywhere in the app", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(screen.getByRole("tree", { name: "Workspace" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("{Meta>}k{/Meta}");

    expect(
      await screen.findByRole("combobox", { name: "Search tasks" }),
    ).toBeInTheDocument();
  });

  it("closes on Escape and forgets the previous query", async () => {
    const user = userEvent.setup();

    renderShell();

    const input = await openSearch(user);

    await user.type(input, "roadmap");

    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Reopening starts clean rather than restoring a search the user has
    // already forgotten making.
    const reopened = await openSearch(user);

    expect(reopened).toHaveValue("");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});

describe("matching", () => {
  it("matches on the title and groups the hit under its list path", async () => {
    const user = userEvent.setup();

    renderShell();

    const input = await openSearch(user);

    await user.type(input, "roadmap");

    await waitFor(() => {
      expect(optionTitles().join(" ")).toMatch(/Draft the Q3 roadmap outline/);
    });

    // Grouped by the full ancestor path, so two lists of the same name are
    // tellable apart.
    expect(within(palette()).getByText(/Engineering \/ /)).toBeInTheDocument();
  });

  it("matches on the description and shows the line that matched", async () => {
    const user = userEvent.setup();

    renderShell();

    const input = await openSearch(user);

    // Seeded only in t-001's description, never in a title.
    await user.type(input, "automate");

    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });

    const option = screen.getAllByRole("option")[0];

    expect(option).toBeDefined();
    expect(option?.textContent).toContain(
      "Define onboarding checklist for new workspaces",
    );
    // The excerpt, not the whole description.
    expect(option?.textContent).toMatch(/can automate/);
  });

  it("marks the matched substring rather than only colouring it", async () => {
    const user = userEvent.setup();

    renderShell();

    const input = await openSearch(user);

    await user.type(input, "roadmap");

    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });

    // `<mark>` carries the semantics of a relevance highlight, so the emphasis
    // is not conveyed by colour alone (Requirement 17.7).
    const marks = within(palette()).getAllByText("roadmap", {
      selector: "mark",
    });

    expect(marks.length).toBeGreaterThan(0);
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();

    renderShell();

    const input = await openSearch(user);

    await user.type(input, "zzzznothing");

    await waitFor(() => {
      expect(
        within(palette()).getByText(/no tasks match/i),
      ).toBeInTheDocument();
    });
  });

  /*
   * A single `(` is enough to throw from an unescaped `RegExp`, which would
   * crash the palette on a keystroke.
   */
  it("survives regex metacharacters in the query", async () => {
    const user = userEvent.setup();

    renderShell();

    const input = await openSearch(user);

    /*
     * `(` and `*` are RegExp metacharacters but not `userEvent` descriptors —
     * `[` and `{` are, which is why this is not simply "([a-".
     */
    await user.type(input, "(.*+?");

    await waitFor(() => {
      expect(
        within(palette()).getByText(/no tasks match/i),
      ).toBeInTheDocument();
    });

    expect(input).toHaveValue("(.*+?");
  });
});

describe("permission scoping", () => {
  /*
   * The whole reason this is worth testing: Bob is denied the Infra list, so
   * its task titles must not reach him through the search box even though the
   * tasks exist in the same store (Requirement 8.8).
   */
  it("hides tasks from a denied list", async () => {
    const user = userEvent.setup();

    renderShell();

    const infraTask = Object.values(useStore.getState().tasks).find(
      (task) => task.primaryListId === SEED_IDS.lists.infra,
    );

    expect(infraTask).toBeDefined();

    const needle = "unit guard";

    // Alice is an admin and sees it.
    const asAlice = await openSearch(user);

    await user.type(asAlice, needle);

    await waitFor(() => {
      expect(optionTitles().join(" ")).toMatch(/unit guard/i);
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await switchTo(user, /Bob Mensah/);

    const asBob = await openSearch(user);

    await user.type(asBob, needle);

    /*
     * Asserted after the debounce has had time to settle and produce the empty
     * state, so this cannot pass merely by checking too early.
     */
    await waitFor(() => {
      expect(
        within(palette()).getByText(/no tasks match/i),
      ).toBeInTheDocument();
    });

    expect(optionTitles()).toHaveLength(0);
  });

  it("hides tasks in a private space from a user with no grant", async () => {
    const user = userEvent.setup();

    renderShell();

    await switchTo(user, /Bob Mensah/);

    const input = await openSearch(user);

    // Marketing is private and Bob has no grant; Carol has an explicit allow.
    await user.type(input, "campaign");

    await waitFor(() => {
      expect(
        within(palette()).getByText(/no tasks match/i),
      ).toBeInTheDocument();
    });
  });
});

describe("choosing a result", () => {
  /*
   * A hit can live in a list other than the selected one, so choosing it has
   * to navigate as well as open — and in that order, since selecting a list
   * clears the open task by design.
   */
  it("navigates to the hit's list and opens the task", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(
        screen.getByRole("navigation", { name: "Breadcrumb" }),
      ).toHaveTextContent("Backlog");
    });

    const input = await openSearch(user);

    // A task in Sprint 14, which is not the list currently open.
    await user.type(input, "keyboard navigation");

    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });

    await user.keyboard("{ArrowDown}{Enter}");

    const drawer = await screen.findByRole("dialog", {
      name: "Add keyboard navigation to the sidebar tree",
    });

    /*
     * The drawer is modal, so the breadcrumb behind it is hidden from the
     * accessibility tree. Its own path row carries the same information, and
     * is the thing a user actually reads at this moment.
     */
    expect(
      within(drawer).getByRole("navigation", { name: "Task path" }),
    ).toHaveTextContent("Sprint 14");

    // Closing it reveals that the shell navigated too, not just the drawer.
    await user.click(within(drawer).getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(
        screen.getByRole("navigation", { name: "Breadcrumb" }),
      ).toHaveTextContent("Sprint 14");
    });
  });
});

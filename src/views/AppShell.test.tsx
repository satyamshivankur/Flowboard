import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/contexts/AppProviders";
import { useStore } from "@/controllers/store";
import { createSeedState, SEED_IDS } from "@/model/seed";

import { AppShell } from "./AppShell";

/**
 * The chrome, end to end.
 *
 * This is the test the brief asks for by name: switching user must visibly
 * change what the tree and content show, with no reload (Requirement 8.3,
 * 8.14, 18.7).
 *
 * It renders the real shell against the real store, so a regression in the
 * permission engine, the selectors, the hooks or the sidebar all surface here.
 */

function renderShell() {
  return render(
    <AppProviders>
      <AppShell />
    </AppProviders>,
  );
}

/** The sidebar tree, which is the one with `role="tree"`. */
function tree() {
  return screen.getByRole("tree", { name: "Workspace" });
}

async function expandAll(user: ReturnType<typeof userEvent.setup>) {
  // Spaces and folders start collapsed; open everything reachable so list
  // visibility can be asserted directly.
  for (let pass = 0; pass < 3; pass += 1) {
    const collapsed = within(tree())
      .queryAllByRole("treeitem", { expanded: false })
      .filter((item) => item.getAttribute("aria-expanded") === "false");

    if (collapsed.length === 0) return;

    for (const item of collapsed) {
      const toggle = item.querySelector("button");

      if (toggle) await user.click(toggle);
    }
  }
}

beforeEach(() => {
  // Each test starts from the seed, since the store is a module singleton.
  useStore.setState((state) => ({
    ...state,
    ...createSeedState(),
    currentUserId: SEED_IDS.users.alice,
    isHydrating: false,
    loadingListId: null,
  }));

  window.localStorage.clear();
});

describe("first load", () => {
  it("opens the first list the current user can see", async () => {
    renderShell();

    await waitFor(() => {
      expect(
        screen.getByRole("navigation", { name: "Breadcrumb" }),
      ).toHaveTextContent("Backlog");
    });
  });

  it("renders the sidebar tree with the workspace's spaces", async () => {
    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    expect(within(tree()).getByText("Engineering")).toBeInTheDocument();
    expect(within(tree()).getByText("Marketing")).toBeInTheDocument();
  });
});

describe("switching user changes what is visible", () => {
  /*
   * The 30-second demo, asserted. Alice is an admin and sees the private
   * Marketing space; Bob is a member with an explicit deny on Infra and no
   * grant on Marketing.
   */
  it("hides Marketing from Bob and shows it to Alice", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(within(tree()).getByText("Marketing")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));

    await waitFor(() => {
      expect(within(tree()).queryByText("Marketing")).not.toBeInTheDocument();
    });

    expect(within(tree()).getByText("Engineering")).toBeInTheDocument();
  });

  it("hides the denied Infra list from Bob but keeps it for Carol", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await expandAll(user);

    expect(within(tree()).getByText("Infra")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));
    await expandAll(user);

    await waitFor(() => {
      expect(within(tree()).queryByText("Infra")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Carol Diaz/ }));
    await expandAll(user);

    await waitFor(() => {
      expect(within(tree()).getByText("Infra")).toBeInTheDocument();
    });
  });

  /*
   * A folder Bob can see whose only child he cannot would otherwise be an
   * expandable dead end (Requirement 6.8).
   */
  it("explains an empty folder rather than rendering a dead end", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));
    await expandAll(user);

    await waitFor(() => {
      expect(
        within(tree()).getByText(/no lists you can access/i),
      ).toBeInTheDocument();
    });
  });

  it("shows the current user's role on the switcher", async () => {
    const user = userEvent.setup();

    renderShell();

    const switcher = await screen.findByRole("button", {
      name: /switch user/i,
    });

    expect(switcher).toHaveTextContent("Admin");

    await user.click(switcher);
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /switch user/i }),
      ).toHaveTextContent("Member");
    });
  });

  /*
   * The menu is where the permission demo is driven from, so each row shows
   * the same three things the trigger does rather than one line of text
   * (Requirement 8.2, 8.14).
   */
  it("renders each switcher row with an avatar, a name and a role", async () => {
    const user = userEvent.setup();

    renderShell();

    await user.click(
      await screen.findByRole("button", { name: /switch user/i }),
    );

    const menu = await screen.findByRole("menu");

    for (const [name, role] of [
      ["Alice Nguyen", "Admin"],
      ["Bob Mensah", "Member"],
      ["Carol Diaz", "Member"],
    ]) {
      const item = within(menu).getByRole("menuitem", {
        name: new RegExp(name ?? ""),
      });

      // The avatar is a labelled `role="img"`, so this distinguishes "the
      // avatar rendered" from "the initials appear somewhere as text".
      expect(
        within(item).getByRole("img", { name: name ?? "" }),
      ).toBeInTheDocument();
      expect(item).toHaveTextContent(name ?? "");
      expect(item).toHaveTextContent(role ?? "");
    }
  });

  /*
   * The current user was marked with a left-hand `icon: Check`, which is
   * rendered `aria-hidden` — so a screen-reader user had no way at all to tell
   * who they were acting as. `selected` puts it in the accessible name and
   * moves the tick to where every other menu in the app puts it.
   */
  it("marks the current user as selected, in the accessible name", async () => {
    const user = userEvent.setup();

    renderShell();

    await user.click(
      await screen.findByRole("button", { name: /switch user/i }),
    );

    const menu = await screen.findByRole("menu");

    expect(
      within(menu).getByRole("menuitem", { name: /Alice Nguyen.*selected/ }),
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /Bob Mensah.*selected/ }),
    ).not.toBeInTheDocument();

    await user.click(
      within(menu).getByRole("menuitem", { name: /Bob Mensah/ }),
    );

    await user.click(screen.getByRole("button", { name: /switch user/i }));

    const reopened = await screen.findByRole("menu");

    expect(
      within(reopened).getByRole("menuitem", { name: /Bob Mensah.*selected/ }),
    ).toBeInTheDocument();
    expect(
      within(reopened).queryByRole("menuitem", {
        name: /Alice Nguyen.*selected/,
      }),
    ).not.toBeInTheDocument();
  });
});

describe("recovering from a denied selection", () => {
  /*
   * Alice opens Infra, then the app switches to Bob, who is denied it. The
   * content region must say so and offer a way out, not render an empty board
   * (Requirement 8.13).
   */
  it("offers a reachable list when the open one becomes invisible", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await expandAll(user);
    await user.click(within(tree()).getByText("Infra"));

    await waitFor(() => {
      expect(
        screen.getByRole("navigation", { name: "Breadcrumb" }),
      ).toHaveTextContent("Infra");
    });

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));

    await waitFor(() => {
      expect(screen.getByText(/don't have access/i)).toBeInTheDocument();
    });

    // And the escape hatch works.
    await user.click(screen.getByRole("button", { name: /^Open/ }));

    await waitFor(() => {
      expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
    });
  });
});

describe("structural actions are permission-gated in the UI", () => {
  it("disables archive for a member and explains why", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    await user.click(screen.getByRole("menuitem", { name: /Bob Mensah/ }));
    await expandAll(user);

    const engineering = within(tree()).getByText("Engineering").closest("li");

    expect(engineering).not.toBeNull();

    await user.click(
      within(engineering as HTMLElement).getByRole("button", {
        name: /Engineering actions/i,
      }),
    );

    const archive = await screen.findByRole("menuitem", { name: /archive/i });

    expect(archive).toBeDisabled();
    expect(archive).toHaveAttribute("title", expect.stringMatching(/admin/i));
  });
});

describe("view switching", () => {
  it("switches between the board and list views", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(
        screen.getByRole("radiogroup", { name: "View" }),
      ).toBeInTheDocument();
    });

    const group = screen.getByRole("radiogroup", { name: "View" });

    expect(within(group).getByRole("radio", { name: "Board" })).toBeChecked();

    await user.click(within(group).getByRole("radio", { name: "List" }));

    await waitFor(() => {
      expect(within(group).getByRole("radio", { name: "List" })).toBeChecked();
    });
  });
});

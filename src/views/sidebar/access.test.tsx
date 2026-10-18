import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/contexts/AppProviders";
import { useStore } from "@/controllers/store";
import { createSeedState, SEED_IDS } from "@/model/seed";

import { AppShell } from "../AppShell";

/**
 * Deciding access, through the real UI.
 *
 * The Model and Controller tests prove the grant arithmetic; this proves the
 * two moments a user actually goes through — choosing access while creating a
 * container, and changing it afterwards — reach that arithmetic and change what
 * another user sees (Requirement 8.15, 8.16, 18.7).
 */

function renderShell() {
  return render(
    <AppProviders>
      <AppShell />
    </AppProviders>,
  );
}

function tree() {
  return screen.getByRole("tree", { name: "Workspace" });
}

type User = ReturnType<typeof userEvent.setup>;

async function expandAll(user: User) {
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

async function switchTo(user: User, name: RegExp) {
  await user.click(screen.getByRole("button", { name: /switch user/i }));
  await user.click(screen.getByRole("menuitem", { name }));
}

/** Opens the row's overflow menu by the row's visible name. */
async function openRowMenu(user: User, rowName: string) {
  const row = within(tree()).getByText(rowName).closest("li");

  expect(row).not.toBeNull();

  await user.click(
    within(row as HTMLElement).getByRole("button", {
      name: new RegExp(`${rowName} actions`, "i"),
    }),
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

describe("choosing access while creating a container", () => {
  it("opens restricted, so a new space reaches nobody by default", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(screen.getByRole("menuitem", { name: /new space/i }));

    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByRole("checkbox", {
        name: /everyone in the workspace/i,
      }),
    ).not.toBeChecked();

    for (const member of ["Bob Mensah", "Carol Diaz"]) {
      expect(
        within(dialog).getByRole("checkbox", { name: member }),
      ).not.toBeChecked();
    }

    // The summary is the one place the consequence is stated in words.
    expect(dialog).toHaveTextContent(/only admins will be able to see/i);
  });

  /*
   * "Everyone" is the select-all for the list below it, not a mode above it.
   * Ticking it fills the list; clearing it empties the list.
   */
  it("ticks and clears every member from the Everyone checkbox", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(screen.getByRole("menuitem", { name: /new space/i }));

    const dialog = await screen.findByRole("dialog");
    const everyone = within(dialog).getByRole("checkbox", {
      name: /everyone in the workspace/i,
    });

    await user.click(everyone);

    expect(everyone).toBeChecked();
    expect(
      within(dialog).getByRole("checkbox", { name: "Bob Mensah" }),
    ).toBeChecked();
    expect(
      within(dialog).getByRole("checkbox", { name: "Carol Diaz" }),
    ).toBeChecked();
    expect(dialog).toHaveTextContent(/including anyone added later/i);

    await user.click(everyone);

    expect(everyone).not.toBeChecked();
    expect(
      within(dialog).getByRole("checkbox", { name: "Bob Mensah" }),
    ).not.toBeChecked();
    expect(dialog).toHaveTextContent(/only admins will be able to see/i);
  });

  /*
   * A partially filled list reports `mixed`, so the next click reads as
   * "include everyone" rather than toggling from a state it does not describe.
   */
  it("reports a partial selection as mixed, and completes it in one click", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(screen.getByRole("menuitem", { name: /new space/i }));

    const dialog = await screen.findByRole("dialog");

    await user.click(
      within(dialog).getByRole("checkbox", { name: "Carol Diaz" }),
    );

    const everyone = within(dialog).getByRole("checkbox", {
      name: /everyone in the workspace/i,
    });

    expect(everyone).toHaveAttribute("aria-checked", "mixed");

    await user.click(everyone);

    expect(everyone).toBeChecked();
    expect(
      within(dialog).getByRole("checkbox", { name: "Bob Mensah" }),
    ).toBeChecked();
  });

  it("grants only the member ticked at creation", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(screen.getByRole("menuitem", { name: /new space/i }));

    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Finance");
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Carol Diaz" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(within(tree()).getByText("Finance")).toBeInTheDocument();
    });

    // Carol was ticked, Bob was not.
    await switchTo(user, /Carol Diaz/);

    await waitFor(() => {
      expect(within(tree()).getByText("Finance")).toBeInTheDocument();
    });

    await switchTo(user, /Bob Mensah/);

    await waitFor(() => {
      expect(within(tree()).queryByText("Finance")).not.toBeInTheDocument();
    });
  });

  /*
   * An admin's row is shown ticked and disabled rather than hidden. Omitting it
   * would read as "the admin has no access", which is the opposite of true.
   */
  it("shows an admin as permanently included", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(screen.getByRole("menuitem", { name: /new space/i }));

    const dialog = await screen.findByRole("dialog");
    const aliceRow = within(dialog).getByRole("checkbox", {
      name: "Alice Nguyen",
    });

    expect(aliceRow).toBeChecked();
    expect(aliceRow).toBeDisabled();
    expect(dialog).toHaveTextContent(/always has access/i);
  });
});

describe("editing access afterwards", () => {
  it("revokes a member's access to an existing list", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await expandAll(user);
    await openRowMenu(user, "Backlog");
    await user.click(
      await screen.findByRole("menuitem", { name: /manage access/i }),
    );

    const dialog = await screen.findByRole("dialog");

    // Backlog is public in the seed, so everyone starts ticked.
    expect(
      within(dialog).getByRole("checkbox", {
        name: /everyone in the workspace/i,
      }),
    ).toBeChecked();
    expect(
      within(dialog).getByRole("checkbox", { name: "Bob Mensah" }),
    ).toBeChecked();

    await user.click(
      within(dialog).getByRole("checkbox", { name: "Bob Mensah" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: /save access/i }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await switchTo(user, /Bob Mensah/);
    await expandAll(user);

    await waitFor(() => {
      expect(within(tree()).queryByText("Backlog")).not.toBeInTheDocument();
    });

    // Only Backlog changed; the sibling list is still his.
    expect(within(tree()).getByText("Sprint 14")).toBeInTheDocument();
  });

  it("restores access to a list a member was denied", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await expandAll(user);
    await openRowMenu(user, "Infra");
    await user.click(
      await screen.findByRole("menuitem", { name: /manage access/i }),
    );

    const dialog = await screen.findByRole("dialog");

    // Infra is public with an explicit deny on Bob, so his box starts clear.
    const bob = within(dialog).getByRole("checkbox", { name: "Bob Mensah" });

    expect(bob).not.toBeChecked();

    await user.click(bob);
    await user.click(
      within(dialog).getByRole("button", { name: /save access/i }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await switchTo(user, /Bob Mensah/);
    await expandAll(user);

    await waitFor(() => {
      expect(within(tree()).getByText("Infra")).toBeInTheDocument();
    });
  });

  it("disables the access action for a member, with a reason", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(tree()).toBeInTheDocument();
    });

    await switchTo(user, /Bob Mensah/);
    await expandAll(user);
    await openRowMenu(user, "Engineering");

    const item = await screen.findByRole("menuitem", {
      name: /manage access/i,
    });

    expect(item).toBeDisabled();
    expect(item).toHaveAttribute("title", expect.stringMatching(/admin/i));
  });
});

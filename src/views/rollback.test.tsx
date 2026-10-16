import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/contexts/AppProviders";
import { useStore } from "@/controllers/store";
import { createSeedState, SEED_IDS } from "@/model/seed";

import { AppShell } from "./AppShell";

/**
 * Optimistic rollback, driven through the dev panel.
 *
 * `src/controllers/rollback.test.ts` already proves the pipeline restores
 * state, and `views.test.tsx` proves a rejected reorder leaves a task's
 * position untouched. Neither goes through the control a reviewer actually
 * uses: the panel's "Fail next operation" switch.
 *
 * This does, because that path has two extra links in it that the unit tests
 * skip — the Simulation context writing through to the transport's
 * module-level settings, and the one-shot trigger being consumed by exactly
 * one mutation (Requirement 9.7, 9.8, 23.3).
 */

function renderShell() {
  return render(
    <AppProviders>
      <AppShell />
    </AppProviders>,
  );
}

/** Task titles in the "To do" column, in the order the board renders them. */
function todoOrder(): string[] {
  const column = screen.getByRole("region", { name: "To do" });

  return within(column)
    .getAllByRole("button")
    .map((element) => element.getAttribute("aria-label") ?? "")
    .filter((label) => !label.startsWith("Add task"))
    .filter((label) => !label.startsWith("Actions for"));
}

/** Arms the one-shot failure through the panel, as the demo does. */
async function armFailure(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: "Simulation settings" }),
  );
  await user.click(
    await screen.findByRole("menuitem", { name: "Fail next operation" }),
  );

  // The panel confirms it armed, which is also how a reviewer knows.
  await waitFor(() => {
    expect(screen.getByText("Armed")).toBeInTheDocument();
  });
}

const FIRST = "Define onboarding checklist for new workspaces";
const SECOND = "Audit empty states across the product";

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

describe("the dev panel's forced failure", () => {
  it("arms, then shows the panel reflecting its armed state", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: FIRST }),
      ).toBeInTheDocument();
    });

    await armFailure(user);

    await user.click(
      screen.getByRole("button", { name: "Simulation settings" }),
    );

    expect(
      await screen.findByRole("menuitem", {
        name: "Next operation will fail",
      }),
    ).toBeInTheDocument();
  });

  /*
   * The behaviour the brief asks to demonstrate: the move is applied
   * optimistically, the transport rejects it, and the board returns to the
   * exact ordering it had — not merely to *an* ordering (Requirement 4.8,
   * 9.10, 14.12).
   */
  it("rolls a rejected reorder back to the exact previous ordering", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: FIRST })).toBeInTheDocument();
    });

    const before = todoOrder();
    const positionsBefore = Object.fromEntries(
      Object.values(useStore.getState().tasks).map((task) => [
        task.id,
        task.position,
      ]),
    );

    expect(before[0]).toBe(FIRST);
    expect(before[1]).toBe(SECOND);

    await armFailure(user);

    await user.click(screen.getByRole("button", { name: `Actions for ${FIRST}` }));
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Move down",
      }),
    );

    // The failure surfaces as a retryable toast rather than silently.
    expect(await screen.findByText("Connection problem")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(todoOrder()).toEqual(before);
    });

    /*
     * Fractional positions are the thing that could drift: restoring a
     * *sequence* while leaving the underlying numbers changed would look
     * correct and then misorder the next insert.
     */
    const positionsAfter = Object.fromEntries(
      Object.values(useStore.getState().tasks).map((task) => [
        task.id,
        task.position,
      ]),
    );

    expect(positionsAfter).toEqual(positionsBefore);
  });

  it("consumes the trigger, so the retry succeeds", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: FIRST })).toBeInTheDocument();
    });

    await armFailure(user);

    await user.click(screen.getByRole("button", { name: `Actions for ${FIRST}` }));
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Move down",
      }),
    );

    const retry = await screen.findByRole("button", { name: "Try again" });

    await user.click(retry);

    /*
     * "Fail next" is one-shot, so the retry runs against a healthy transport
     * and the move lands. Retrying is safe because the mutation is a closure
     * over its inputs rather than something consumed by the first attempt.
     */
    await waitFor(() => {
      expect(todoOrder()[0]).toBe(SECOND);
    });

    expect(todoOrder()[1]).toBe(FIRST);
  });

  it("leaves everything alone when the failure is armed and then reset", async () => {
    const user = userEvent.setup();

    renderShell();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: FIRST })).toBeInTheDocument();
    });

    await armFailure(user);

    await user.click(
      screen.getByRole("button", { name: "Simulation settings" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Reset simulation" }),
    );

    await user.click(screen.getByRole("button", { name: `Actions for ${FIRST}` }));
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Move down",
      }),
    );

    await waitFor(() => {
      expect(todoOrder()[0]).toBe(SECOND);
    });

    expect(screen.queryByText("Connection problem")).not.toBeInTheDocument();
  });
});

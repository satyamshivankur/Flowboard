import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppProviders } from "@/contexts/AppProviders";
import { useStore } from "@/controllers/store";
import { createSeedState, SEED_IDS } from "@/model/seed";

import { AppShell } from "./AppShell";
import { KanbanBoard } from "./board/KanbanBoard";
import { TaskListView } from "./list/TaskListView";

/**
 * Responsive stories.
 *
 * Every surface that changes shape across a breakpoint gets one story per
 * shape, so the small layout is reviewable on its own rather than only as a
 * narrow window onto the assembled app (Requirement 20.14).
 *
 * The shapes being exercised:
 *
 * - **Board** — one snap-paged column with a dot pager at base, columns side
 *   by side from `md`.
 * - **List** — stacked cards and a sort dropdown at base, a real table with
 *   sortable headers from `md`.
 * - **Sidebar** — an off-canvas sheet below `lg`, static above, at one of two
 *   fixed widths depending on whether it is collapsed to its icon rail.
 * - **Top bar** — a single row throughout, shedding labels for icons at base.
 *
 * Note what is *not* here: there is no story per viewport for the drawer's
 * sheet-versus-panel swap, because `UI/Overlays` already demonstrates it on
 * the `Drawer` primitive itself.
 */

const meta = {
  title: "Responsive",
  parameters: {
    // The shell owns its own scrolling and fills the frame, so the default
    // padded layout would fight it.
    layout: "fullscreen",
  },
  beforeEach: () => {
    useStore.setState((state) => ({
      ...state,
      ...createSeedState(),
      currentUserId: SEED_IDS.users.alice,
      isHydrating: false,
      loadingListId: null,
    }));
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function BoardFrame() {
  return (
    <AppProviders initialListId={SEED_IDS.lists.backlog}>
      <div className="h-dvh bg-surface-sunken">
        <KanbanBoard listId={SEED_IDS.lists.backlog} />
      </div>
    </AppProviders>
  );
}

function ListFrame() {
  return (
    <AppProviders initialListId={SEED_IDS.lists.backlog}>
      <div className="flex h-dvh flex-col bg-surface">
        <TaskListView listId={SEED_IDS.lists.backlog} />
      </div>
    </AppProviders>
  );
}

function ShellFrame() {
  return (
    <AppProviders
      initialListId={SEED_IDS.lists.backlog}
      initialExpandedIds={[SEED_IDS.spaces.engineering, SEED_IDS.folders.q2]}
    >
      <AppShell />
    </AppProviders>
  );
}

export const BoardPhone: Story = {
  name: "Board · phone",
  parameters: { viewport: { defaultViewport: "phone" } },
  render: BoardFrame,
};

export const BoardDesktop: Story = {
  name: "Board · desktop",
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: BoardFrame,
};

export const ListPhone: Story = {
  name: "List · phone",
  parameters: { viewport: { defaultViewport: "phone" } },
  render: ListFrame,
};

export const ListDesktop: Story = {
  name: "List · desktop",
  parameters: { viewport: { defaultViewport: "desktop" } },
  render: ListFrame,
};

/** Sidebar as an off-canvas sheet and the top bar in its compact form. */
export const ShellPhone: Story = {
  name: "Shell · phone",
  parameters: { viewport: { defaultViewport: "phone" } },
  render: ShellFrame,
};

/** The `md` midpoint: wider content, sidebar still off-canvas. */
export const ShellTablet: Story = {
  name: "Shell · tablet",
  parameters: { viewport: { defaultViewport: "tablet" } },
  render: ShellFrame,
};

/** From `lg` the sidebar becomes a static region of the layout. */
export const ShellDesktop: Story = {
  name: "Shell · desktop",
  parameters: { viewport: { defaultViewport: "laptop" } },
  render: ShellFrame,
};

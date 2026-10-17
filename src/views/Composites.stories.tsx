import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppProviders } from "@/contexts/AppProviders";
import {
  buildTaskCard,
  type TaskCardViewModel,
} from "@/controllers/hooks/useBoard";
import { useVisibleTree } from "@/controllers/hooks/useVisibleTree";
import { useStore } from "@/controllers/store";
import { createSeedState, SEED_IDS, SEED_NOW } from "@/model/seed";

import { KanbanColumn } from "./board/KanbanColumn";
import { TaskCard, type TaskCardStatusOption } from "./board/TaskCard";
import { TaskDrawer } from "./drawer/TaskDrawer";
import { SidebarTree } from "./sidebar/SidebarTree";

/**
 * Composite stories, driven by the seed fixture.
 *
 * A primitive can be reviewed from literal props, but a card, a column, the
 * tree and the drawer only tell the truth when fed the same shapes the app
 * feeds them. These stories therefore build their view-models with the real
 * `buildTaskCard` and the real hooks against a seeded store, so a change to a
 * selector shows up here rather than only in the assembled app
 * (Requirement 11.8).
 *
 * `SEED_NOW` is the reference time, which is what makes "overdue" and "due
 * today" render deterministically rather than depending on the day the
 * workbench is opened.
 */

const seed = createSeedState();

/** A card view-model for a seeded task, by id. */
function cardFor(taskId: string): TaskCardViewModel {
  const task = seed.tasks[taskId];

  if (!task) throw new Error(`No seeded task ${taskId}`);

  return buildTaskCard(seed, task, SEED_NOW);
}

const STATUSES: TaskCardStatusOption[] = [
  { id: "st-bk-todo", name: "To do", colorToken: "status-todo" },
  { id: "st-bk-active", name: "In progress", colorToken: "status-active" },
  { id: "st-bk-done", name: "Done", colorToken: "status-done" },
];

const MEMBERS = [
  { id: SEED_IDS.users.alice, name: "Alice Nguyen" },
  { id: SEED_IDS.users.bob, name: "Bob Mensah" },
  { id: SEED_IDS.users.carol, name: "Carol Diaz" },
];

const MOVE_TARGETS = [
  { id: SEED_IDS.lists.sprint14, name: "Sprint 14" },
  { id: SEED_IDS.lists.infra, name: "Infra" },
];

const noop = () => undefined;

/** Nothing is in flight in a story, unless a story says otherwise. */
const nothingPending = () => false;

const CARD_HANDLERS = {
  onOpen: noop,
  onToggleComplete: noop,
  onSetPriority: noop,
  onSetStatus: noop,
  onToggleAssignee: noop,
  onSetDueDate: noop,
  onReorder: noop,
  onDuplicate: noop,
  onMoveToList: noop,
  onDelete: noop,
};

/**
 * Cards and columns are sortables, so they need a `DndContext` and a
 * `SortableContext` above them — the same two wrappers the board supplies.
 */
function Sortable({
  ids,
  children,
}: {
  ids: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <DndContext>
      <SortableContext items={[...ids]}>{children}</SortableContext>
    </DndContext>
  );
}

const meta = {
  title: "Composites/Board",
  beforeEach: () => {
    // The store is a module singleton, so each story restates the seed rather
    // than inheriting whatever the last one left behind.
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

/** Every card shape the seed can produce, side by side. */
export const Cards: Story = {
  render: () => {
    const cards: readonly { label: string; card: TaskCardViewModel }[] = [
      { label: "High priority, assigned, due soon", card: cardFor("t-001") },
      { label: "No due date, unassigned", card: cardFor("t-003") },
      { label: "Description and two assignees", card: cardFor("t-004") },
      { label: "Overdue", card: cardFor("t-006") },
      { label: "Complete (done category)", card: cardFor("t-006") },
      { label: "With subtasks", card: cardFor("t-009") },
    ];

    return (
      <Sortable ids={cards.map((entry) => entry.card.id)}>
        <div className="flex flex-col gap-4">
          {cards.map((entry) => (
            <div key={entry.label} className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-ink-400">{entry.label}</p>
              <div className="w-column">
                <TaskCard
                  task={entry.card}
                  now={SEED_NOW}
                  canEdit
                  statuses={STATUSES}
                  moveTargets={MOVE_TARGETS}
                  members={MEMBERS}
                  index={0}
                  columnLength={2}
                  {...CARD_HANDLERS}
                />
              </div>
            </div>
          ))}
        </div>
      </Sortable>
    );
  },
};

/** The drag clone, which is tilted and elevated rather than a plain copy. */
export const CardOverlay: Story = {
  render: () => (
    <Sortable ids={["t-001"]}>
      <div className="w-column">
        <TaskCard
          task={cardFor("t-001")}
          now={SEED_NOW}
          canEdit
          statuses={STATUSES}
          moveTargets={MOVE_TARGETS}
          members={MEMBERS}
          index={0}
          columnLength={2}
          isOverlay
          {...CARD_HANDLERS}
        />
      </div>
    </Sortable>
  ),
};

/** Mid-save: subdued and `aria-busy`, but still readable and still usable. */
export const CardPending: Story = {
  render: () => (
    <Sortable ids={["t-005"]}>
      <div className="w-column">
        <TaskCard
          task={cardFor("t-005")}
          now={SEED_NOW}
          canEdit
          statuses={STATUSES}
          moveTargets={MOVE_TARGETS}
          members={MEMBERS}
          index={0}
          columnLength={2}
          isPending
          {...CARD_HANDLERS}
        />
      </div>
    </Sortable>
  ),
};

/** A card a member may see but not change: every control disables itself. */
export const CardReadOnly: Story = {
  render: () => (
    <Sortable ids={["t-004"]}>
      <div className="w-column">
        <TaskCard
          task={cardFor("t-004")}
          now={SEED_NOW}
          canEdit={false}
          readOnlyReason="Admins only"
          statuses={STATUSES}
          moveTargets={MOVE_TARGETS}
          members={MEMBERS}
          index={0}
          columnLength={1}
          {...CARD_HANDLERS}
        />
      </div>
    </Sortable>
  ),
};

export const Columns: Story = {
  render: () => {
    const populated = ["t-001", "t-002", "t-003"].map(cardFor);

    return (
      <Sortable ids={populated.map((card) => card.id)}>
        <div className="flex h-96 gap-4">
          <KanbanColumn
            statusId="st-bk-todo"
            name="To do"
            colorToken="status-todo"
            count={populated.length}
            tasks={populated}
            now={SEED_NOW}
            canEdit
            readOnlyReason={undefined}
            statuses={STATUSES}
            moveTargets={MOVE_TARGETS}
            members={MEMBERS}
            isPending={nothingPending}
            onCreate={noop}
            {...CARD_HANDLERS}
          />

          {/* Empty, and still a drop target — an empty column that cannot
              accept a card is a dead end (Requirement 4.9). */}
          <KanbanColumn
            statusId="st-bk-active"
            name="In progress"
            colorToken="status-active"
            count={0}
            tasks={[]}
            now={SEED_NOW}
            canEdit
            readOnlyReason={undefined}
            statuses={STATUSES}
            moveTargets={MOVE_TARGETS}
            members={MEMBERS}
            isPending={nothingPending}
            onCreate={noop}
            {...CARD_HANDLERS}
          />

          {/* Read-only: the add affordance is present but disabled, rather
              than missing and unexplained. */}
          <KanbanColumn
            statusId="st-bk-done"
            name="Done"
            colorToken="status-done"
            count={1}
            tasks={[cardFor("t-006")]}
            now={SEED_NOW}
            canEdit={false}
            readOnlyReason="Admins only"
            statuses={STATUSES}
            moveTargets={[]}
            members={MEMBERS}
            isPending={nothingPending}
            onCreate={noop}
            {...CARD_HANDLERS}
          />
        </div>
      </Sortable>
    );
  },
};

/* -------------------------------------------------------------------------- */
/* Tree and drawer                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Feeds `SidebarTree` from the real hook rather than from hand-written rows,
 * so the story exercises the permission filtering too.
 */
function TreeHost() {
  const tree = useVisibleTree();

  return (
    <div className="w-sidebar">
      <SidebarTree
        rows={tree.nodes}
        isLoading={tree.isLoading}
        onRename={noop}
        onCreateChild={noop}
      />
    </div>
  );
}

export const Tree: StoryObj<typeof meta> = {
  name: "Sidebar tree",
  render: () => (
    <AppProviders
      initialListId={SEED_IDS.lists.backlog}
      initialExpandedIds={[SEED_IDS.spaces.engineering, SEED_IDS.folders.q2]}
    >
      <TreeHost />
    </AppProviders>
  ),
};

/**
 * The drawer, opened on a seeded task with subtasks. `initialOpenTaskId` is
 * what makes this reviewable directly instead of requiring a click through the
 * board to reach it.
 */
export const Drawer: StoryObj<typeof meta> = {
  name: "Task drawer",
  render: () => (
    <AppProviders
      initialListId={SEED_IDS.lists.sprint14}
      initialOpenTaskId="t-009"
    >
      <TaskDrawer orderedTaskIds={["t-007", "t-009", "t-008"]} />
    </AppProviders>
  ),
};

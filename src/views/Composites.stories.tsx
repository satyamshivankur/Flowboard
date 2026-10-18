import { DragDropProvider } from "@dnd-kit/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { AvatarGroupMember } from "@/components/ui/AvatarGroup";
import { PAGE_SIZE, POSITION_GAP } from "@/config/limits";
import { PRIORITIES } from "@/config/priorities";
import { AppProviders } from "@/contexts/AppProviders";
import {
  buildTaskCard,
  type TaskCardViewModel,
} from "@/controllers/hooks/useBoard";
import { useTaskTable } from "@/controllers/hooks/useTaskTable";
import { useVisibleTree } from "@/controllers/hooks/useVisibleTree";
import { useStore } from "@/controllers/store";
import { dueDateAtDays } from "@/lib/date";
import { createSeedState, SEED_IDS, SEED_NOW } from "@/model/seed";
import type { FlowboardState } from "@/model/state";
import type { SortState, Task } from "@/model/types";

import { KanbanColumn } from "./board/KanbanColumn";
import { TaskCard, type TaskCardStatusOption } from "./board/TaskCard";
import { TaskDrawer } from "./drawer/TaskDrawer";
import { TaskCardList } from "./list/TaskCardList";
import { TaskListView } from "./list/TaskListView";
import { TaskTable } from "./list/TaskTable";
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

const MEMBERS: AvatarGroupMember[] = [
  {
    id: SEED_IDS.users.alice,
    name: "Alice Nguyen",
    avatarToken: "avatar-indigo",
  },
  { id: SEED_IDS.users.bob, name: "Bob Mensah", avatarToken: "avatar-teal" },
  { id: SEED_IDS.users.carol, name: "Carol Diaz", avatarToken: "avatar-amber" },
];

const MOVE_TARGETS = [
  { id: SEED_IDS.lists.sprint14, name: "Sprint 14" },
  { id: SEED_IDS.lists.infra, name: "Infra" },
];

const noop = () => undefined;

/** Nothing is in flight in a story, unless a story says otherwise. */
const nothingPending = () => false;

/** No subtasks revealed, unless a story says otherwise. */
const NOTHING_EXPANDED: ReadonlySet<string> = new Set();

const CARD_HANDLERS = {
  onOpen: noop,
  onRename: noop,
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
 * Cards and columns are sortables, so they need a provider above them — the
 * one wrapper the board supplies. dnd-kit no longer needs a `SortableContext`
 * listing the ids: each card states its own group and index.
 */
function Sortable({ children }: { children: React.ReactNode }) {
  return <DragDropProvider>{children}</DragDropProvider>;
}

/*
 * Titled "Composites" rather than "Composites/Board": this file has carried
 * the sidebar tree and the task drawer for a while, and now the list view too,
 * so a board-specific heading was filing three of them under the wrong thing.
 * Each story names itself, which is what the sidebar groups on.
 */
const meta = {
  title: "Composites",
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
  name: "Board · cards",
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
      <Sortable>
        <div className="flex flex-col gap-4">
          {cards.map((entry) => (
            <div key={entry.label} className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-ink-400">{entry.label}</p>
              <div className="w-column">
                <TaskCard
                  task={entry.card}
                  columnId="st-bk-todo"
                  now={SEED_NOW}
                  canEdit
                  statuses={STATUSES}
                  moveTargets={MOVE_TARGETS}
                  members={MEMBERS}
                  index={0}
                  columnLength={2}
                  isPending={nothingPending}
                  expandedIds={NOTHING_EXPANDED}
                  onToggleExpand={noop}
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
  name: "Board · card overlay",
  render: () => (
    <Sortable>
      <div className="w-column">
        <TaskCard
          task={cardFor("t-001")}
          columnId="st-bk-todo"
          now={SEED_NOW}
          canEdit
          statuses={STATUSES}
          moveTargets={MOVE_TARGETS}
          members={MEMBERS}
          index={0}
          columnLength={2}
          isPending={nothingPending}
          expandedIds={NOTHING_EXPANDED}
          onToggleExpand={noop}
          isOverlay
          {...CARD_HANDLERS}
        />
      </div>
    </Sortable>
  ),
};

/** Mid-save: subdued and `aria-busy`, but still readable and still usable. */
export const CardPending: Story = {
  name: "Board · card saving",
  render: () => (
    <Sortable>
      <div className="w-column">
        <TaskCard
          task={cardFor("t-005")}
          columnId="st-bk-todo"
          now={SEED_NOW}
          canEdit
          statuses={STATUSES}
          moveTargets={MOVE_TARGETS}
          members={MEMBERS}
          index={0}
          columnLength={2}
          isPending={() => true}
          expandedIds={NOTHING_EXPANDED}
          onToggleExpand={noop}
          {...CARD_HANDLERS}
        />
      </div>
    </Sortable>
  ),
};

/** A card a member may see but not change: every control disables itself. */
export const CardReadOnly: Story = {
  name: "Board · card read-only",
  render: () => (
    <Sortable>
      <div className="w-column">
        <TaskCard
          task={cardFor("t-004")}
          columnId="st-bk-todo"
          now={SEED_NOW}
          canEdit={false}
          readOnlyReason="Admins only"
          statuses={STATUSES}
          moveTargets={MOVE_TARGETS}
          members={MEMBERS}
          index={0}
          columnLength={1}
          isPending={nothingPending}
          expandedIds={NOTHING_EXPANDED}
          onToggleExpand={noop}
          {...CARD_HANDLERS}
        />
      </div>
    </Sortable>
  ),
};

export const Columns: Story = {
  name: "Board · columns",
  render: () => {
    const populated = ["t-001", "t-002", "t-003"].map(cardFor);

    return (
      <Sortable>
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
            isDragOver={false}
            isPending={nothingPending}
            expandedIds={NOTHING_EXPANDED}
            onToggleExpand={noop}
            onReorderInColumn={noop}
            onCreate={noop}
            {...CARD_HANDLERS}
          />

          {/* Empty, and shown mid-drag. The highlight is driven by a prop the
              board resolves, not by the column's own `isOver` — which is false
              whenever a card wins the collision, so only empty columns used to
              light up (Requirement 4.6, 4.9). */}
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
            isDragOver
            isPending={nothingPending}
            expandedIds={NOTHING_EXPANDED}
            onToggleExpand={noop}
            onReorderInColumn={noop}
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
            isDragOver={false}
            isPending={nothingPending}
            expandedIds={NOTHING_EXPANDED}
            onToggleExpand={noop}
            onReorderInColumn={noop}
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
        onManageAccess={noop}
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

/* -------------------------------------------------------------------------- */
/* List view                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The list view's states, which split into two groups for a structural reason.
 *
 * `TaskListView` owns sort, page and the expanded-row set in its own
 * `useState`, so a story cannot set them from outside. The states that *are*
 * those three — every sort order, a row expanded, a page boundary — are
 * therefore driven through `TableHost` below, which calls the real
 * `useTaskTable` and hands `TaskTable` the pieces the view would have held.
 * Nothing about the data is faked: the hook runs the real selectors, the real
 * comparator and the real pagination arithmetic against the seeded store.
 *
 * The states that belong to the *view* rather than the table — the loading
 * skeleton, the empty state and the load-more control — render the real
 * `TaskListView`, because those are the parts `TaskTable` knows nothing about.
 *
 * Viewport coverage is deliberately not here: `Responsive.stories.tsx` already
 * renders this view at phone and desktop widths, and duplicating that would be
 * two places to keep in step.
 */

/** A list and the three state slices `TaskListView` normally keeps to itself. */
interface TableHostProps {
  readonly listId?: string;
  readonly initialSort?: SortState;
  readonly page?: number;
  readonly initialExpandedIds?: readonly string[];
  /** Renders one row mid-save, which the view keys by task id. */
  readonly pendingTaskId?: string | undefined;
  readonly canEdit?: boolean;
  readonly readOnlyReason?: string | undefined;
}

/**
 * `TaskTable` fed by the real hook.
 *
 * Sort and expansion stay interactive — clicking a header re-sorts through the
 * real comparator and the chevron really expands — so this is a workbench
 * rather than a screenshot. Each story sets where it starts.
 */
function TableHost({
  listId = SEED_IDS.lists.backlog,
  initialSort = { field: "dueDate", direction: "asc" },
  page = 0,
  initialExpandedIds = [],
  pendingTaskId,
  canEdit = true,
  readOnlyReason,
}: TableHostProps) {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(initialExpandedIds),
  );

  const table = useTaskTable(listId, sort, page, SEED_NOW);

  return (
    <TaskTable
      rows={table.rows}
      now={SEED_NOW}
      sort={sort}
      canEdit={canEdit}
      readOnlyReason={readOnlyReason}
      isPending={(taskId) => taskId === pendingTaskId}
      statuses={table.statuses}
      members={table.members}
      expandedIds={expandedIds}
      onSortChange={(field) => {
        setSort((current) =>
          current.field === field
            ? {
                field,
                direction: current.direction === "asc" ? "desc" : "asc",
              }
            : { field, direction: "asc" },
        );
      }}
      onToggleExpand={(taskId) => {
        setExpandedIds((current) => {
          const next = new Set(current);

          if (next.has(taskId)) {
            next.delete(taskId);
          } else {
            next.add(taskId);
          }

          return next;
        });
      }}
      onOpen={noop}
      onToggleComplete={noop}
      onRename={noop}
      onSetStatus={noop}
      onSetPriority={noop}
      onSetDueDate={noop}
      onToggleAssignee={noop}
      onCreateSubtask={noop}
    />
  );
}

/** A labelled block, so a story showing several states stays readable. */
function Labelled({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-ink-400">{label}</p>
      {note !== undefined && <p className="text-xs text-ink-600">{note}</p>}
      {children}
    </div>
  );
}

/**
 * Replaces the Backlog list's tasks with exactly `count` synthetic ones.
 *
 * Pagination cannot be reached from the seed: `PAGE_SIZE` is 25 and the
 * largest seeded list holds six top-level tasks. Rather than lower the page
 * size for the story — which would demonstrate a page size the app never uses
 * — this seeds enough rows to cross the real boundary.
 *
 * Deterministic on purpose: fixed ids, priorities cycling through the
 * configured set, and due dates derived from `SEED_NOW`, so the story renders
 * the same rows every time it is opened.
 */
function withBacklogTasks(count: number): Partial<FlowboardState> {
  const seeded = createSeedState();
  const statusIds = ["st-bk-todo", "st-bk-active", "st-bk-done"];

  const tasks: Record<string, Task> = Object.fromEntries(
    Object.entries(seeded.tasks).filter(
      ([, task]) => task.primaryListId !== SEED_IDS.lists.backlog,
    ),
  );

  for (let index = 0; index < count; index += 1) {
    const id = `t-bulk-${String(index + 1).padStart(3, "0")}`;

    tasks[id] = {
      id,
      workspaceId: SEED_IDS.workspace,
      primaryListId: SEED_IDS.lists.backlog,
      parentTaskId: null,
      title: `Backlog item ${String(index + 1)}`,
      description: null,
      statusId: statusIds[index % statusIds.length] ?? "st-bk-todo",
      priority: PRIORITIES[index % PRIORITIES.length] ?? "none",
      assigneeIds: index % 3 === 0 ? [SEED_IDS.users.alice] : [],
      // Every fourth row is unscheduled, so "nulls last" stays visible at scale.
      dueDate: index % 4 === 3 ? null : dueDateAtDays(SEED_NOW, index - 3),
      position: POSITION_GAP * (index + 1),
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    };
  }

  return { tasks };
}

/** Applies a domain-state patch over a fresh seed, for a story's `beforeEach`. */
function installState(
  patch: Partial<FlowboardState>,
  loadingListId: string | null = null,
) {
  useStore.setState((state) => ({
    ...state,
    ...createSeedState(),
    ...patch,
    currentUserId: SEED_IDS.users.alice,
    isHydrating: false,
    loadingListId,
  }));
}

/** A list host, for the states that belong to the view rather than the table. */
function ListHost({ listId = SEED_IDS.lists.backlog }: { listId?: string }) {
  return (
    <AppProviders initialListId={listId}>
      <div className="flex h-[32rem] flex-col">
        <TaskListView listId={listId} />
      </div>
    </AppProviders>
  );
}

/** The default: populated, due-date ascending, nothing expanded. */
export const ListTable: Story = {
  name: "List view · table",
  render: () => (
    <AppProviders initialListId={SEED_IDS.lists.backlog}>
      <TableHost />
    </AppProviders>
  ),
};

/**
 * Every sort order the view offers, each rendered by the real comparator.
 *
 * Two of these are the requirements that a hand-written comparator gets wrong.
 * Due date puts unscheduled tasks last in **both** directions, so flipping to
 * descending does not float them to the top (5.4). Priority follows
 * `PRIORITY_CONFIG[p].rank` rather than alphabetical order, so "urgent" leads
 * and "none" trails (5.3).
 *
 * Headers stay clickable, so the `aria-sort` indicator and the ordering can be
 * checked against each other rather than taken on trust.
 */
export const ListSorting: Story = {
  name: "List view · sort orders",
  render: () => {
    const orders: readonly {
      label: string;
      note?: string;
      sort: SortState;
    }[] = [
      {
        label: "Due date, ascending",
        note: "Soonest first, unscheduled last.",
        sort: { field: "dueDate", direction: "asc" },
      },
      {
        label: "Due date, descending",
        note: "Latest first — and unscheduled still last, not first (5.4).",
        sort: { field: "dueDate", direction: "desc" },
      },
      {
        label: "Priority, ascending",
        note: "Semantic rank, so urgent leads rather than alphabetical (5.3).",
        sort: { field: "priority", direction: "asc" },
      },
      {
        label: "Priority, descending",
        sort: { field: "priority", direction: "desc" },
      },
      {
        label: "Title, ascending",
        sort: { field: "title", direction: "asc" },
      },
      {
        label: "Status, ascending",
        note: "By the status's own position in this list's set, not its name.",
        sort: { field: "status", direction: "asc" },
      },
    ];

    return (
      <AppProviders initialListId={SEED_IDS.lists.backlog}>
        <div className="flex flex-col gap-6">
          {orders.map((order) => (
            <Labelled
              key={order.label}
              label={order.label}
              {...(order.note === undefined ? {} : { note: order.note })}
            >
              <TableHost initialSort={order.sort} />
            </Labelled>
          ))}
        </div>
      </AppProviders>
    );
  },
};

/**
 * Subtasks, collapsed and expanded.
 *
 * Sprint 14 is the seeded list with a parent task, and the point of showing
 * both is that a subtask appears *only* under its parent — never as a
 * top-level row, and never counted as one by pagination (5.7).
 */
export const ListSubtasks: Story = {
  name: "List view · subtasks",
  render: () => (
    <AppProviders initialListId={SEED_IDS.lists.sprint14}>
      <div className="flex flex-col gap-6">
        <Labelled
          label="Collapsed"
          note="The parent shows a disclosure chevron; its children are absent."
        >
          <TableHost listId={SEED_IDS.lists.sprint14} />
        </Labelled>

        <Labelled
          label="Expanded"
          note="Children render indented beneath the parent that owns them."
        >
          <TableHost
            listId={SEED_IDS.lists.sprint14}
            initialExpandedIds={["t-009"]}
          />
        </Labelled>
      </div>
    </AppProviders>
  ),
};

/**
 * One row mid-save.
 *
 * Subdued and `aria-busy`, at the row that was acted on rather than behind a
 * global overlay — a 300ms write is not a reason to take the table away
 * (14.7). The other rows stay fully usable, which is the part a global spinner
 * gets wrong.
 */
export const ListRowSaving: Story = {
  name: "List view · row saving",
  render: () => (
    <AppProviders initialListId={SEED_IDS.lists.backlog}>
      <TableHost pendingTaskId="t-001" />
    </AppProviders>
  ),
};

/**
 * A list the current user may read but not write.
 *
 * Every inline control disables itself and says why, rather than accepting the
 * edit and failing on submit (7.10, 8.11). Reached by prop here because no
 * seeded role produces it: members may edit tasks in any list they can see, so
 * the read-only path is a capability-table state rather than a seed state.
 */
export const ListReadOnly: Story = {
  name: "List view · read-only",
  render: () => (
    <AppProviders initialListId={SEED_IDS.lists.backlog}>
      <TableHost canEdit={false} readOnlyReason="Admins only" />
    </AppProviders>
  ),
};

/** The phone form: a stacked card per task, same data, same drawer. */
export const ListCards: Story = {
  name: "List view · cards (phone form)",
  render: () => (
    <AppProviders initialListId={SEED_IDS.lists.backlog}>
      <div className="w-column-mobile">
        <CardListHost />
      </div>
    </AppProviders>
  ),
};

/** `TaskCardList` fed by the same hook the table uses. */
function CardListHost() {
  const table = useTaskTable(
    SEED_IDS.lists.backlog,
    { field: "dueDate", direction: "asc" },
    0,
    SEED_NOW,
  );

  return (
    <TaskCardList
      rows={table.rows}
      now={SEED_NOW}
      canEdit
      isPending={(taskId) => taskId === "t-002"}
      statuses={table.statuses}
      members={table.members}
      onOpen={noop}
      onToggleComplete={noop}
      onRename={noop}
      onSetStatus={noop}
      onSetPriority={noop}
      onSetDueDate={noop}
      onToggleAssignee={noop}
      onCreateSubtask={noop}
    />
  );
}

/**
 * First page of 42, with the load-more control.
 *
 * The real `TaskListView`, because the control is the view's and not the
 * table's. The count in the button is what makes the state legible — "25 of
 * 42" rather than a bare "Load more" that could mean anything. Clicking it
 * advances cumulatively and exhausts the list, so both halves of pagination
 * are reachable from this one story (9.12).
 */
export const ListPagination: Story = {
  name: "List view · pagination",
  beforeEach: () => {
    installState(withBacklogTasks(PAGE_SIZE + 17));
  },
  render: () => <ListHost />,
};

/**
 * Exactly `PAGE_SIZE` rows, and therefore **no** control.
 *
 * The boundary is worth its own story because it is where the arithmetic can
 * be wrong by one: `hasMore` is `end < total`, so 25 of 25 must offer nothing
 * to load. A story at 24 or 26 rows would not catch a `<=` here.
 */
export const ListPaginationBoundary: Story = {
  name: "List view · page boundary (no control)",
  beforeEach: () => {
    installState(withBacklogTasks(PAGE_SIZE));
  },
  render: () => <ListHost />,
};

/**
 * A list with nothing in it.
 *
 * The empty state carries the create action itself rather than pointing at the
 * board, because sending someone to another view to do the obvious next thing
 * is a dead end, not an empty state (5.9, 14.3).
 */
export const ListEmpty: Story = {
  name: "List view · empty",
  beforeEach: () => {
    installState(withBacklogTasks(0));
  },
  render: () => <ListHost />,
};

/**
 * Mid-load.
 *
 * Row skeletons sized to the rows they stand in for, so the table does not
 * jump when the data arrives (14.1, 14.2). Driven by `loadingListId`, which is
 * the same flag a real list switch sets.
 */
export const ListLoading: Story = {
  name: "List view · loading",
  beforeEach: () => {
    installState({}, SEED_IDS.lists.backlog);
  },
  render: () => <ListHost />,
};

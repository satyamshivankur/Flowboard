import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  MeasuringStrategy,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Columns3 } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type UIEvent } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Priority } from "@/config/priorities";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useBoard } from "@/controllers/hooks/useBoard";
import { usePendingAction } from "@/controllers/hooks/usePendingAction";
import { cn } from "@/lib/cn";

import { ReadOnlyNotice } from "../states/ReadOnlyNotice";
import type { ViewProps } from "../viewComponents";

import { BoardPager } from "./BoardPager";
import {
  columnsFromPlan,
  crossColumnMove,
  finalDrop,
  isNoOpDrop,
  planFrom,
  type DragPlan,
} from "./dragPlan";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";

/**
 * Pointer first, geometry as the fallback.
 *
 * `closestCorners` alone measures from the *dragged card's* corners, so in a
 * non-empty column it almost always resolved to whichever card sat nearest the
 * column's top-left — which is why every cross-column drop landed at the top
 * regardless of where the pointer was.
 *
 * `pointerWithin` answers the question actually being asked: what is under the
 * cursor. It returns nothing during a keyboard drag, where there is no pointer,
 * so `closestCorners` still backs it up.
 */
const boardCollisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);

  return underPointer.length > 0 ? underPointer : closestCorners(args);
};


/**
 * The kanban board.
 *
 * Drag-and-drop is optimistic: the card lands under the cursor immediately and
 * the exact pre-drag ordering is restored if the mutation fails
 * (Requirement 4.8, 14.12). Arm "fail next operation" in the dev panel to see
 * it.
 */
export function KanbanBoard({ listId }: ViewProps) {
  /*
   * One reference time for the whole board, fixed at mount. Reading the clock
   * per card would let two cards disagree about whether today is today, and
   * passing it down keeps "overdue" deterministic in tests and stories.
   */
  const now = useMemo(() => new Date().toISOString(), []);
  const board = useBoard(listId, now);
  const { openTask } = useNavigation();
  const { confirm } = useConfirm();

  /*
   * Keyed by task id, so the card that was acted on is the one that dims —
   * rather than a global overlay taking the board away for 300ms
   * (Requirement 14.7).
   */
  const { run, isPending } = usePendingAction();

  const [draggingId, setDraggingId] = useState<string | null>(null);

  /*
   * The board's task order while a drag is live.
   *
   * Held here rather than derived, because this *is* what gets rendered: the
   * dragged card has to sit in the destination column's own `SortableContext`
   * for the sorting strategy to open a gap for it. `onDragOver` moves it
   * between columns and nothing else, which is what keeps this from looping —
   * see the note in `dragPlan.ts`.
   */
  const [plan, setPlan] = useState<DragPlan | null>(null);

  /*
   * Which column the phone layout is showing. Derived from scroll position
   * rather than from a page counter, so a flick, a snap and a tap on the pager
   * all agree about where the user is.
   */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeColumn, setActiveColumn] = useState(0);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    const centre = scroller.scrollLeft + scroller.clientWidth / 2;

    let nearest = 0;
    let smallest = Number.POSITIVE_INFINITY;

    for (const [index, child] of [...scroller.children].entries()) {
      const element = child as HTMLElement;
      const distance = Math.abs(
        element.offsetLeft + element.offsetWidth / 2 - centre,
      );

      if (distance < smallest) {
        smallest = distance;
        nearest = index;
      }
    }

    setActiveColumn(nearest);
  }, []);

  const scrollToColumn = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    const target = scroller?.children[index];

    if (!scroller || !(target instanceof HTMLElement)) return;

    scroller.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
  }, []);

  const sensors = useSensors(
    // 8px before a drag starts, so a click still opens the card.
    // px-exception: a pointer threshold, not a rendered dimension.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    /*
     * The press delay is what separates "long-press to drag a card" from
     * "scroll the column" and "swipe to the next column". Without it every
     * swipe on a phone starts a drag and the board becomes unusable
     * (Requirement 20.8).
     */
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    /*
     * Space picks up and drops; Escape cancels. Enter is deliberately removed
     * from dnd-kit's defaults so it keeps a single meaning on a card — open
     * the drawer — rather than both starting a drag and opening details
     * (Requirement 4.11, 17.5).
     */
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: ["Space"],
        cancel: ["Escape"],
        end: ["Space"],
      },
    }),
  );

  /*
   * What the board shows: the plan while dragging, the store otherwise.
   * Untouched columns keep their object identity, so a drag does not remount
   * every card on the board.
   */
  const columns = useMemo(
    () => columnsFromPlan(board.columns, plan),
    [board.columns, plan],
  );

  const draggingColumnId = useMemo(() => {
    if (plan === null || draggingId === null) return undefined;

    return Object.keys(plan).find((statusId) =>
      plan[statusId]?.includes(draggingId),
    );
  }, [plan, draggingId]);

  /*
   * Derived from the *store's* columns, not the previewed ones.
   *
   * This is the single largest cost at a crossing. A status's id, name and
   * colour cannot change during a drag, but reading them off the previewed
   * columns produced a fresh array every time the plan changed — which gave
   * every `TaskCard` a new `statuses` prop, defeated `memo` on all of them,
   * and rebuilt every card's twenty-item menu at the exact moment the drag
   * needed the main thread.
   */
  const statusOptions = useMemo(
    () =>
      board.columns.map((column) => ({
        id: column.statusId,
        name: column.name,
        colorToken: column.colorToken,
      })),
    [board.columns],
  );

  /* Column names are fixed during a drag, so the pager reads the store too. */
  const columnNames = useMemo(
    () => board.columns.map((column) => column.name),
    [board.columns],
  );

  const dragging = useMemo(
    () =>
      draggingId === null
        ? undefined
        : columns
            .flatMap((column) => column.tasks)
            .find((task) => task.id === draggingId),
    [draggingId, columns],
  );

  /** Spoken updates, so a drag is followable without sight (Req 4.11, 17.5). */
  const announcements = useMemo(
    (): Announcements => ({
      onDragStart: ({ active }) => `Picked up task ${String(active.id)}.`,
      onDragOver: ({ over }) =>
        over ? `Moved over ${String(over.id)}.` : "No drop target.",
      onDragEnd: ({ over }) =>
        over ? `Dropped on ${String(over.id)}.` : "Drop cancelled.",
      onDragCancel: () => "Drag cancelled. The task returned to its place.",
    }),
    [],
  );

  /**
   * Tracks the destination as the pointer moves.
   *
   * `isBelowMidpoint` is the half of this that cannot be derived from ids: past
   * the midpoint of the hovered card the insertion belongs after it, and
   * without that the bottom slot of a column is unreachable by pointer.
   */
  /**
   * Moves the dragged card between columns as the pointer crosses them.
   *
   * Only between. Reordering inside a column is left to
   * `verticalListSortingStrategy`, which does it with transforms and no React
   * state — so once the card is in its destination this returns the same plan
   * object, React bails out, and nothing re-measures. That early return is the
   * whole defence against the update loop that crashed this before.
   */
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeRect = active.rect.current.translated;
    const overRect = over.rect;
    const isBelowMidpoint =
      activeRect !== null &&
      activeRect.top + activeRect.height / 2 >
        overRect.top + overRect.height / 2;

    setPlan((current) =>
      current === null
        ? current
        : crossColumnMove(
            current,
            String(active.id),
            String(over.id),
            isBelowMidpoint,
          ),
    );
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const committed = plan;

      setDraggingId(null);
      setPlan(null);

      /*
       * No target means Escape, or a drop outside any column. Either way the
       * card returns to where it was and nothing is written
       * (Requirement 4.7).
       */
      if (!over || committed === null) return;

      const activeId = String(active.id);

      /*
       * Resolved against the plan — the order actually on screen — so the
       * committed index is the one the user watched the card settle into.
       * Recomputing from the store's columns is what previously disagreed with
       * the board in front of them.
       */
      const target = finalDrop(committed, activeId, String(over.id));

      // Dropped back where it started: nothing to write (Requirement 4.7).
      if (isNoOpDrop(board.columns, activeId, target) || target === null) {
        return;
      }

      /*
       * Routed through `run` so a rejected move surfaces as a retryable toast.
       * The store has already rolled the card back to its exact pre-drag
       * position by the time this resolves (Requirement 4.8, 14.12).
       */
      void run(
        activeId,
        () => board.onMoveTask(activeId, target.statusId, target.index),
        { retryable: true },
      );
    },
    [board, run, plan],
  );

  /*
   * Every card handler is hoisted into a `useCallback`.
   *
   * Not tidiness: these were inline arrows, so each render of the board handed
   * every card eleven brand-new functions. That defeats `memo` on `TaskCard`
   * entirely, and the board re-renders on every pointer event of a drag — so
   * all of the cards, with all of their pickers and menus, were rebuilding
   * continuously. That is the stutter.
   */
  const handleRename = useCallback(
    (taskId: string, title: string) => {
      void run(taskId, () => board.onQuickUpdate(taskId, { title }), {
        retryable: true,
      });
    },
    [board, run],
  );

  const handleToggleComplete = useCallback(
    (taskId: string) => {
      void run(taskId, () => board.onToggleComplete(taskId), {
        retryable: true,
      });
    },
    [board, run],
  );

  const handleSetPriority = useCallback(
    (taskId: string, priority: string) => {
      void run(
        taskId,
        () => board.onQuickUpdate(taskId, { priority: priority as Priority }),
        { retryable: true },
      );
    },
    [board, run],
  );

  const handleSetStatus = useCallback(
    (taskId: string, statusId: string) => {
      void run(taskId, () => board.onQuickUpdate(taskId, { statusId }), {
        retryable: true,
      });
    },
    [board, run],
  );

  const handleSetDueDate = useCallback(
    (taskId: string, dueDate: string | null) => {
      void run(taskId, () => board.onQuickUpdate(taskId, { dueDate }), {
        retryable: true,
      });
    },
    [board, run],
  );

  /** Keyboard and menu reordering, which needs the column it happens in. */
  const handleReorder = useCallback(
    (taskId: string, statusId: string, toIndex: number) => {
      void run(taskId, () => board.onMoveTask(taskId, statusId, toIndex), {
        retryable: true,
      });
    },
    [board, run],
  );

  const handleDuplicate = useCallback(
    (taskId: string) => {
      void run(taskId, () => board.onDuplicateTask(taskId), {
        successTitle: "Task duplicated",
      });
    },
    [board, run],
  );

  const handleMoveToList = useCallback(
    (taskId: string, targetListId: string) => {
      void run(taskId, () => board.onMoveToList(taskId, targetListId), {
        successTitle: "Task moved",
      });
    },
    [board, run],
  );

  const handleCreate = useCallback(
    (statusId: string, title: string) => {
      void run(statusId, () => board.onCreateTask(statusId, title), {
        retryable: true,
      });
    },
    [board, run],
  );

  /** Toggling one assignee without disturbing the rest of the list. */
  const handleToggleAssignee = useCallback(
    (taskId: string, userId: string) => {
      const task = board.columns
        .flatMap((column) => column.tasks)
        .find((candidate) => candidate.id === taskId);

      if (!task) return;

      const current = task.assignees.map((user) => user.id);
      const next = current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId];

      void run(
        taskId,
        () => board.onQuickUpdate(taskId, { assigneeIds: next }),
        { retryable: true },
      );
    },
    [board, run],
  );

  const handleDelete = useCallback(
    (taskId: string) => {
      void (async () => {
        const task = board.columns
          .flatMap((column) => column.tasks)
          .find((candidate) => candidate.id === taskId);

        if (!task) return;

        const confirmed = await confirm({
          title: `Delete "${task.title}"?`,
          body:
            task.subtaskCount === 0
              ? "This cannot be undone."
              : `${String(task.subtaskCount)} subtask(s) will be deleted too. This cannot be undone.`,
          confirmLabel: "Delete",
          tone: "danger",
        });

        if (!confirmed) return;

        void run(taskId, () => board.onDeleteTask(taskId), {
          successTitle: "Task deleted",
        });
      })();
    },
    [board, confirm, run],
  );

  if (board.isLoading) {
    return (
      <div className="flex h-full gap-3 overflow-x-auto p-3 md:gap-4 md:p-6">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} variant="column" lines={2} />
        ))}
      </div>
    );
  }

  if (board.columns.length === 0) {
    return (
      <EmptyState
        icon={Columns3}
        title="This list has no statuses"
        description="A list needs at least one status before it can show a board."
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      accessibility={{ announcements }}
      /*
       * Re-measure while dragging. The card moving between columns changes
       * their heights, and with the default measuring those rects are taken
       * once at pickup — so every collision after the first crossing is
       * computed against a stale layout, which is what made the drag feel like
       * it was fighting the cursor.
       */
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={(event: DragStartEvent) => {
        setDraggingId(String(event.active.id));
        setPlan(planFrom(board.columns));
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggingId(null);
        setPlan(null);
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/*
          Stated once, at the top of the surface, rather than by every disabled
          control individually — and visibly, which `title` cannot manage on a
          touch device (Requirement 8.11, 17.2, 20.10).
        */}
        <ReadOnlyNotice reason={board.readOnlyReason} subject="list" />

        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className={cn(
            "flex min-h-0 flex-1 gap-3 overflow-x-auto p-3",
            // Scroll-snap paging on a phone, plain horizontal scroll from `md`.
            "snap-x snap-mandatory md:snap-none md:gap-4 md:p-6",
          )}
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column.statusId}
              isDragOver={draggingColumnId === column.statusId}
              statusId={column.statusId}
              name={column.name}
              colorToken={column.colorToken}
              /*
               * The plan's length, so the header agrees with the cards under
               * it while a card is mid-flight between columns.
               */
              count={column.tasks.length}
              tasks={column.tasks}
              now={now}
              canEdit={board.canEdit}
              readOnlyReason={board.readOnlyReason}
              statuses={statusOptions}
              moveTargets={board.moveTargets}
              members={board.members}
              isPending={isPending}
              onOpen={openTask}
              onRename={handleRename}
              onToggleComplete={handleToggleComplete}
              onSetPriority={handleSetPriority}
              onSetStatus={handleSetStatus}
              onToggleAssignee={handleToggleAssignee}
              onSetDueDate={handleSetDueDate}
              onReorderInColumn={handleReorder}
              onDuplicate={handleDuplicate}
              onMoveToList={handleMoveToList}
              onDelete={handleDelete}
              /*
               * Creation has no task id yet, so it keys on the column. The
               * composer input is what shows progress here.
               */
              onCreate={handleCreate}
            />
          ))}
        </div>

        <BoardPager
          names={columnNames}
          activeIndex={activeColumn}
          onSelect={scrollToColumn}
        />
      </div>

      {/*
        The overlay is a separate, tilted clone that follows the cursor while
        the source slot keeps a subdued placeholder of identical size — so the
        column height never jumps mid-drag (Requirement 15.6, 4.6).
      */}
      {/*
        The default drop animation, not `null`. Suppressing it made every drop
        land with a snap: the overlay vanished and the card reappeared
        elsewhere in the same frame. Letting dnd-kit animate the overlay into
        its final position is most of what "smooth" means here
        (Requirement 14.11).
      */}
      <DragOverlay>
        {dragging && (
          <TaskCard
            task={dragging}
            now={now}
            canEdit={board.canEdit}
            readOnlyReason={board.readOnlyReason}
            statuses={statusOptions}
            moveTargets={board.moveTargets}
            members={board.members}
            index={0}
            columnLength={1}
            isOverlay
            onRename={() => undefined}
            onOpen={() => undefined}
            onToggleComplete={() => undefined}
            onSetPriority={() => undefined}
            onSetStatus={() => undefined}
            onToggleAssignee={() => undefined}
            onSetDueDate={() => undefined}
            onReorder={() => undefined}
            onDuplicate={() => undefined}
            onMoveToList={() => undefined}
            onDelete={() => undefined}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

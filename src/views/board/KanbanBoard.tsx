import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
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
import { useAction } from "@/controllers/hooks/useAction";
import { useBoard } from "@/controllers/hooks/useBoard";
import { cn } from "@/lib/cn";

import type { ViewProps } from "../viewComponents";

import { BoardPager } from "./BoardPager";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";

/** Resolves a drop into a destination status and index within it. */
function resolveDrop(
  columns: ReturnType<typeof useBoard>["columns"],
  activeId: string,
  overId: string,
): { statusId: string; index: number } | null {
  // Dropped on a column's empty space: append.
  const column = columns.find((candidate) => candidate.statusId === overId);

  if (column) {
    return { statusId: column.statusId, index: column.tasks.length };
  }

  // Dropped on a card: take that card's column and position.
  const target = columns.find((candidate) =>
    candidate.tasks.some((task) => task.id === overId),
  );

  if (!target) return null;

  const index = target.tasks.findIndex((task) => task.id === overId);
  const from = columns.find((candidate) =>
    candidate.tasks.some((task) => task.id === activeId),
  );

  /*
   * Moving down within the same column shifts every later card up by one once
   * the dragged card leaves, so the raw index would land one slot short.
   */
  if (from?.statusId === target.statusId) {
    const currentIndex = from.tasks.findIndex((task) => task.id === activeId);

    return {
      statusId: target.statusId,
      index: currentIndex < index ? index + 1 : index,
    };
  }

  return { statusId: target.statusId, index };
}

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

  const { run } = useAction();

  const [draggingId, setDraggingId] = useState<string | null>(null);

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

  const statusOptions = useMemo(
    () =>
      board.columns.map((column) => ({
        id: column.statusId,
        name: column.name,
      })),
    [board.columns],
  );

  const dragging = useMemo(
    () =>
      draggingId === null
        ? undefined
        : board.columns
            .flatMap((column) => column.tasks)
            .find((task) => task.id === draggingId),
    [draggingId, board.columns],
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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null);

      const { active, over } = event;

      /*
       * No target means Escape, or a drop outside any column. Either way the
       * card returns to where it was and nothing is written
       * (Requirement 4.7).
       */
      if (!over) return;

      const activeId = String(active.id);
      const drop = resolveDrop(board.columns, activeId, String(over.id));

      if (!drop) return;

      /*
       * Routed through `run` so a rejected move surfaces as a retryable toast.
       * The store has already rolled the card back to its exact pre-drag
       * position by the time this resolves (Requirement 4.8, 14.12).
       */
      void run(() => board.onMoveTask(activeId, drop.statusId, drop.index), {
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

      void run(() => board.onQuickUpdate(taskId, { assigneeIds: next }), {
        retryable: true,
      });
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

        void run(() => board.onDeleteTask(taskId), {
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
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={(event: DragStartEvent) => {
        setDraggingId(String(event.active.id));
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggingId(null);
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className={cn(
            "flex min-h-0 flex-1 gap-3 overflow-x-auto p-3",
            // Scroll-snap paging on a phone, plain horizontal scroll from `md`.
            "snap-x snap-mandatory md:snap-none md:gap-4 md:p-6",
          )}
        >
          {board.columns.map((column) => (
            <KanbanColumn
              key={column.statusId}
              statusId={column.statusId}
              name={column.name}
              colorToken={column.colorToken}
              count={column.count}
              tasks={column.tasks}
              now={now}
              canEdit={board.canEdit}
              statuses={statusOptions}
              moveTargets={board.moveTargets}
              members={board.members}
              onOpen={openTask}
              onToggleComplete={(taskId) => {
                void run(() => board.onToggleComplete(taskId), {
                  retryable: true,
                });
              }}
              onSetPriority={(taskId, priority) => {
                void run(
                  () =>
                    board.onQuickUpdate(taskId, {
                      priority: priority as Priority,
                    }),
                  { retryable: true },
                );
              }}
              onSetStatus={(taskId, statusId) => {
                void run(() => board.onQuickUpdate(taskId, { statusId }), {
                  retryable: true,
                });
              }}
              onToggleAssignee={handleToggleAssignee}
              onSetDueDate={(taskId, dueDate) => {
                void run(() => board.onQuickUpdate(taskId, { dueDate }), {
                  retryable: true,
                });
              }}
              onReorder={(taskId, toIndex) => {
                void run(
                  () => board.onMoveTask(taskId, column.statusId, toIndex),
                  { retryable: true },
                );
              }}
              onDuplicate={(taskId) => {
                void run(() => board.onDuplicateTask(taskId), {
                  successTitle: "Task duplicated",
                });
              }}
              onMoveToList={(taskId, targetListId) => {
                void run(() => board.onMoveToList(taskId, targetListId), {
                  successTitle: "Task moved",
                });
              }}
              onDelete={handleDelete}
              onCreate={(statusId, title) => {
                void run(() => board.onCreateTask(statusId, title), {
                  retryable: true,
                });
              }}
            />
          ))}
        </div>

        <BoardPager
          names={board.columns.map((column) => column.name)}
          activeIndex={activeColumn}
          onSelect={scrollToColumn}
        />
      </div>

      {/*
        The overlay is a separate, tilted clone that follows the cursor while
        the source slot keeps a subdued placeholder of identical size — so the
        column height never jumps mid-drag (Requirement 15.6, 4.6).
      */}
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <TaskCard
            task={dragging}
            now={now}
            canEdit={board.canEdit}
            statuses={statusOptions}
            moveTargets={board.moveTargets}
            members={board.members}
            index={0}
            columnLength={1}
            isOverlay
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

import { configure, type Plugins } from "@dnd-kit/abstract";
import {
  Accessibility,
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
  type DragDropManager,
} from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import {
  DragDropProvider,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { Columns3 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";

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
  columnIdOf,
  columnIdOfTarget,
  columnsFromPlan,
  isNoOpDrop,
  locate,
  planFrom,
  type DragPlan,
} from "./dragDrop";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";

/**
 * Input sensors, declared once at module scope.
 *
 * Stable identity matters: handing `DragDropProvider` a fresh array would
 * unregister and re-register every sensor on each render of the board.
 *
 * One `PointerSensor` covers mouse, pen and touch, but not with the same
 * threshold — which is the point of resolving the constraint per event rather
 * than configuring it once:
 *
 *   - A fine pointer waits for 8px of movement, so a click still opens the
 *     card rather than nudging it.
 *   - A touch waits for a 200ms press. Without that, every swipe on a phone
 *     starts a drag and the board can no longer be scrolled at all
 *     (Requirement 20.8). The 10px tolerance is what lets a swipe abort the
 *     press instead of dragging the card along with it.
 *
 * px-exception: both numbers are pointer-movement thresholds in device
 * pixels, never rendered (Requirement 22.4).
 */
const SENSORS = [
  PointerSensor.configure({
    activationConstraints: (event) =>
      event.pointerType === "touch"
        ? [
            new PointerActivationConstraints.Delay({
              value: 200,
              tolerance: 10,
            }),
          ]
        : [new PointerActivationConstraints.Distance({ value: 8 })],
  }),
  /*
   * Space picks up and drops; Escape cancels; arrows move. Enter is
   * deliberately dropped from dnd-kit's defaults — it activates *and* ends a
   * drag out of the box, which would collide with Enter opening the drawer
   * (Requirement 4.11, 17.5).
   */
  KeyboardSensor.configure({
    keyboardCodes: {
      start: ["Space"],
      cancel: ["Escape"],
      end: ["Space"],
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
    },
  }),
];

/** The accessibility plugin's options, which dnd-kit does not export. */
type AccessibilityOptions = NonNullable<
  ConstructorParameters<typeof Accessibility>[1]
>;

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
   * The board's task order while a drag is live, in two places on purpose.
   *
   * The state is what gets rendered. The ref is the same value, readable
   * without waiting for a render — which `onDragEnd` needs, because a drop
   * that follows its last crossing closely must still commit the order the
   * user was looking at rather than whatever a stale closure captured.
   *
   * Mirroring the move into React at all is not an optimisation, it is what
   * keeps the app from crashing: dnd-kit previews a cross-column drag by
   * moving the DOM node itself, and React then tries to remove a child that is
   * no longer where it left it. Doing the move here instead makes dnd-kit
   * stand down — see the note in `dragDrop.ts`.
   */
  const plan = useRef<DragPlan | null>(null);
  const [preview, setPreview] = useState<DragPlan | null>(null);

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

  /*
   * Memoised on the store's columns, which during a drag means it never
   * changes.
   *
   * Worth a note because getting this wrong was expensive: an earlier version
   * derived it from the mid-drag preview, so every card got a new `statuses`
   * prop on each crossing, `memo` was defeated on all of them, and every
   * card's twenty-item menu was rebuilt at the exact moment the drag needed
   * the main thread.
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

  /*
   * What the board renders: the preview while dragging, the store otherwise.
   */
  const columns = useMemo(
    () => columnsFromPlan(board.columns, preview),
    [board.columns, preview],
  );

  /*
   * Which column to highlight, derived from the preview rather than tracked
   * separately — so the highlight cannot disagree with where the card has
   * actually been placed (Requirement 4.6).
   */
  const overColumnId = useMemo(
    () =>
      preview === null || draggingId === null
        ? null
        : columnIdOf(preview, draggingId),
    [preview, draggingId],
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

  /*
   * Human-readable names for everything a drag can touch.
   *
   * Held in a ref so the announcements below can stay a single stable object.
   * dnd-kit re-registers its plugins when the plugin list changes identity,
   * and rebuilding the announcements whenever a task is renamed would do that
   * mid-drag.
   */
  const names = useRef(new Map<string, string>());

  useEffect(() => {
    const map = new Map<string, string>();

    for (const column of board.columns) {
      map.set(column.statusId, column.name);

      for (const task of column.tasks) map.set(task.id, task.title);
    }

    names.current = map;
  }, [board.columns]);

  /**
   * Spoken updates, so a drag is followable without sight (Req 4.11, 17.5).
   *
   * dnd-kit's defaults announce raw ids — "Picked up draggable item t-014" —
   * which is true and useless. These name the task and the column instead,
   * which is the same information the sighted user gets.
   */
  const plugins = useMemo(() => {
    const nameOf = (id: string | number) =>
      names.current.get(String(id)) ?? String(id);

    const announcements: NonNullable<AccessibilityOptions["announcements"]> = {
      dragstart: ({ operation: { source } }) =>
        source ? `Picked up ${nameOf(source.id)}.` : undefined,
      dragover: ({ operation: { source, target } }) => {
        if (!source || !target || source.id === target.id) return undefined;

        const column = columnIdOfTarget(
          isSortable(target) ? { id: target.id, group: target.group } : target,
        );

        return column === null
          ? undefined
          : `${nameOf(source.id)} is over ${nameOf(column)}.`;
      },
      dragend: ({ operation: { source }, canceled }) => {
        if (!source) return undefined;

        if (canceled) {
          return `Cancelled. ${nameOf(source.id)} returned to its place.`;
        }

        /*
         * Read from the ref, not from state: this fires alongside our own
         * `onDragEnd` and there is no guarantee which of the two the monitor
         * calls first. The plan is deliberately left in place until the next
         * drag starts so that either order gives the same sentence.
         */
        const target =
          plan.current === null
            ? null
            : locate(plan.current, String(source.id));

        return target === null
          ? `${nameOf(source.id)} was left where it was.`
          : `Dropped ${nameOf(source.id)} in ${nameOf(target.statusId)}, position ${String(target.index + 1)}.`;
      },
    };

    return (defaults: Plugins<DragDropManager>): Plugins<DragDropManager> => [
      ...defaults,
      configure(Accessibility, { announcements }),
    ];
  }, []);

  /**
   * Re-places the dragged card as the pointer crosses columns and cards.
   *
   * `move` is dnd-kit's own helper, and handing it the whole record is what
   * makes an empty column reachable: the pointer there collides with the
   * column's droppable rather than with any card, and `move` understands a
   * target that is a *key* of the record as well as one that is an item in it.
   * dnd-kit's own optimistic sorting does not — it returns early on a
   * non-sortable target, which is exactly why a drop into an empty column
   * used to do nothing at all (Requirement 4.9).
   *
   * It returns the same object when nothing should change, so hovering around
   * inside a column produces no render. `onDragOver` also fires on target
   * change rather than per pointer event, so this is a handful of renders per
   * drag, not one per frame.
   */
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const current = plan.current;

    if (current === null) return;

    const next = move(current, event);

    if (next === current) return;

    plan.current = next;
    setPreview(next);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { operation, canceled } = event;
      const { source } = operation;

      /*
       * `plan.current` is deliberately *not* cleared here: the accessibility
       * plugin's own `dragend` announcement reads it, and the monitor gives no
       * ordering guarantee between the two. The next `onDragStart` replaces
       * it.
       */
      const committed = plan.current;

      setDraggingId(null);
      setPreview(null);

      /*
       * Escape, or a drop outside any column. The card returns to where it
       * was and nothing is written (Requirement 4.7).
       */
      if (canceled || !source || committed === null) return;

      const activeId = String(source.id);

      /*
       * Resolved against the plan — the order actually on screen — so the
       * committed index is the one the user watched the card settle into.
       */
      const target = locate(committed, activeId);

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
    [board, run],
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
    /*
     * No `collisionDetection` and no `measuring` overrides any more, and both
     * omissions are deliberate.
     *
     * The old board needed a custom detector because `closestCorners`
     * measured from the dragged card's corners and therefore resolved to
     * whichever card sat nearest the column's top-left — "it always lands at
     * the top". It also needed `MeasuringStrategy.Always`, re-measuring every
     * droppable on every move, to keep collisions honest as column heights
     * changed; that constant re-measurement is a good part of what the drag
     * felt like.
     *
     * dnd-kit's current defaults do both properly: collisions are
     * pointer-first with a geometric fallback for keyboard drags, and the
     * manager observes element geometry rather than re-reading it per frame.
     *
     * `plugins` extends the default set rather than replacing it, so
     * auto-scrolling, the grab cursor, selection prevention and the drag
     * feedback all stay — only the announcements are ours.
     */
    <DragDropProvider
      sensors={SENSORS}
      plugins={plugins}
      onDragStart={(event: DragStartEvent) => {
        const { source } = event.operation;

        if (!source) return;

        const captured = planFrom(board.columns);

        plan.current = captured;
        setDraggingId(String(source.id));
        setPreview(captured);
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
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
              isDragOver={overColumnId === column.statusId}
              statusId={column.statusId}
              name={column.name}
              colorToken={column.colorToken}
              /*
               * The preview's length, so the header agrees with the cards
               * under it while a card is mid-flight between columns.
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
        A separate, tilted clone follows the cursor while the real card stays
        in its slot, subdued — so the column height never jumps mid-drag
        (Requirement 15.6, 4.6). Rendering an overlay is also what tells
        dnd-kit's feedback plugin not to lift the original element out of the
        flow and leave a hidden placeholder behind it; the card the user sees
        sitting in the column *is* the card.

        The default drop animation, not `null`. Suppressing it made every drop
        land with a snap: the clone vanished and the card reappeared elsewhere
        in the same frame. Letting dnd-kit animate the clone into its final
        position is most of what "smooth" means here (Requirement 14.11).
      */}
      <DragOverlay>
        {dragging && (
          <TaskCard
            task={dragging}
            columnId={dragging.statusId}
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
    </DragDropProvider>
  );
}

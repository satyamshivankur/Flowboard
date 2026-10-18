import { useSortable } from "@dnd-kit/react/sortable";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarOff,
  ChevronRight,
  Copy,
  CornerUpRight,
  FileText,
  ListTree,
  MoreHorizontal,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { memo, useMemo, type KeyboardEvent, type MouseEvent } from "react";

import { AssigneePicker } from "@/components/ui/AssigneePicker";
import type { AvatarGroupMember } from "@/components/ui/AvatarGroup";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { DueDatePicker } from "@/components/ui/DueDatePicker";
import { IconButton } from "@/components/ui/IconButton";
import { InlineTextField } from "@/components/ui/InlineTextField";
import { Menu, type MenuItemSpec } from "@/components/ui/Menu";
import { PriorityPicker } from "@/components/ui/PriorityPicker";
import { StatusPill } from "@/components/ui/StatusPill";
import { Tooltip } from "@/components/ui/Tooltip";
import { DUE_DATE_PRESETS } from "@/config/dueDates";
import { MAX_TITLE_LEN } from "@/config/limits";
import { PRIORITIES, PRIORITY_CONFIG } from "@/config/priorities";
import type { StatusColorToken } from "@/config/statusCategories";
import type { TaskCardViewModel } from "@/controllers/hooks/useBoard";
import { cn } from "@/lib/cn";
import { dueDateAtDays } from "@/lib/date";

/**
 * Caps on the two unbounded sections of the quick menu. A workspace with forty
 * members would otherwise produce a menu longer than the viewport; the drawer
 * carries the complete pickers (Requirement 15.10).
 */
const MAX_MENU_MEMBERS = 5;
const MAX_MENU_LISTS = 5;

export interface TaskCardStatusOption {
  readonly id: string;
  readonly name: string;
  /**
   * Carried so the quick menu can show the same dot the column header and the
   * drawer picker show. Without it this menu was the one place a status
   * appeared as bare text (Requirement 13.6).
   */
  readonly colorToken: StatusColorToken;
}

export interface TaskCardProps {
  readonly task: TaskCardViewModel;
  /**
   * The column this card is rendered in, which is its sortable *group*.
   *
   * dnd-kit's current release has no `SortableContext`: a card declares which
   * list it belongs to, and that is what makes a drag across columns a
   * transfer between groups rather than a reorder within one.
   */
  readonly columnId: string;
  readonly now: string;
  readonly canEdit: boolean;
  /**
   * Why editing is refused. Attached to every gated menu item, so a greyed
   * "Delete task" explains itself instead of just refusing
   * (Requirement 8.11, 17.2).
   */
  readonly readOnlyReason?: string | undefined;
  /** Statuses of this task's own list, for the quick status change. */
  readonly statuses: readonly TaskCardStatusOption[];
  readonly moveTargets: readonly { id: string; name: string }[];
  /** Workspace members, for assigning without opening the drawer. */
  readonly members: readonly AvatarGroupMember[];
  /** Position in its column, so the menu can offer move up and move down. */
  readonly index: number;
  readonly columnLength: number;
  /** True for the floating clone that follows the cursor. */
  readonly isOverlay?: boolean;
  /**
   * Whether a mutation on a *given* task is in flight (Requirement 14.7).
   *
   * A predicate rather than a boolean, because this card now renders its
   * subtasks too and each of them dims independently — ticking a subtask must
   * not subdue its parent. Same signature the list view's table takes, so the
   * two surfaces key pending state the same way.
   */
  readonly isPending: (taskId: string) => boolean;
  /** Which parents have their subtasks revealed (Requirement 5.7). */
  readonly expandedIds: ReadonlySet<string>;
  readonly onToggleExpand: (taskId: string) => void;
  readonly onOpen: (taskId: string) => void;
  readonly onToggleComplete: (taskId: string) => void;
  readonly onRename: (taskId: string, title: string) => void;
  readonly onSetPriority: (taskId: string, priority: string) => void;
  readonly onSetStatus: (taskId: string, statusId: string) => void;
  readonly onToggleAssignee: (taskId: string, userId: string) => void;
  readonly onSetDueDate: (taskId: string, dueDate: string | null) => void;
  readonly onReorder: (taskId: string, toIndex: number) => void;
  readonly onDuplicate: (taskId: string) => void;
  readonly onMoveToList: (taskId: string, listId: string) => void;
  readonly onDelete: (taskId: string) => void;
}

/**
 * A kanban card.
 *
 * Every quick action here also exists in the drawer, so nothing is reachable
 * only by hovering a card (Requirement 15.10). The affordances that reveal on
 * hover are gated behind `can-hover`, so a coarse pointer gets them
 * persistently visible rather than unreachable (Requirement 15.1, 20.10).
 */
/**
 * Memoised, which is a performance fix rather than a habit.
 *
 * Each card carries four pickers, a twenty-item menu and several tooltips, and
 * a board holds dozens of cards. Under dnd-kit 6 the board re-rendered on
 * every pointer event of a drag and rebuilt all of that continuously; that no
 * longer happens, but a crossing still re-renders the two columns involved to
 * move the highlight, and this is what stops that touching their cards.
 *
 * Only effective because the board hands down stable callbacks — with inline
 * arrows the props differed every render and this wrapper would have cost a
 * comparison and saved nothing.
 */
export const TaskCard = memo(TaskCardImpl);

/**
 * The sortable wrapper, and the only part of a card that drags.
 *
 * Three elements are in play and the split between them is deliberate:
 *
 *   - The **wrapper** is the sortable element. Expanded subtasks live inside
 *     it, so dragging a parent takes its visible children along — which is the
 *     same invariant the Model enforces, where a subtask follows its parent
 *     between lists (Requirement 2.7).
 *   - The parent **card** is the drag *handle*. Without that split, pressing a
 *     subtask would start dragging the parent, and the accessibility plugin
 *     would put `tabindex` and `aria-roledescription` on a wrapper that is not
 *     the thing a user picks up.
 *   - Each **body** is one card's presentation and editing, shared by the
 *     parent and its subtasks so there is literally one set of controls rather
 *     than two that drift.
 */
function TaskCardImpl({
  task,
  columnId,
  now,
  canEdit,
  readOnlyReason,
  statuses,
  moveTargets,
  members,
  index,
  columnLength,
  isOverlay = false,
  isPending,
  expandedIds,
  onToggleExpand,
  onOpen,
  onToggleComplete,
  onRename,
  onSetPriority,
  onSetStatus,
  onToggleAssignee,
  onSetDueDate,
  onReorder,
  onDuplicate,
  onMoveToList,
  onDelete,
}: TaskCardProps) {
  /*
   * One hook, and no context above it.
   *
   * `index` and `group` are what used to be implicit in which
   * `SortableContext` the card happened to be mounted inside. Stating them
   * means dnd-kit can displace the card's neighbours — in either column —
   * without React re-rendering anything, which is the difference this
   * migration was for: a drag no longer produces a render per pointer event.
   *
   * `accept` is narrowed to tasks so a card is never a drop target for
   * anything else, and `type` is what the columns accept in turn.
   */
  const { ref, handleRef, isDragSource } = useSortable({
    id: task.id,
    index,
    group: columnId,
    type: "task",
    accept: "task",
    /*
     * The overlay clone is rendered inside `DragOverlay`, where dnd-kit stubs
     * out registration — but disabling it as well keeps it honestly inert
     * rather than relying on that.
     */
    disabled: !canEdit || isOverlay,
  });

  const shared = {
    now,
    canEdit,
    readOnlyReason,
    statuses,
    members,
    onOpen,
    onToggleComplete,
    onRename,
    onSetPriority,
    onSetStatus,
    onToggleAssignee,
    onSetDueDate,
    onDelete,
  };

  /*
   * The clone deliberately carries no subtasks. It is a thing being dragged,
   * not a thing being read, and nesting a parent's children into it would
   * double its height mid-flight for no information the user needs while the
   * pointer is down.
   */
  const subtasks = isOverlay ? [] : task.subtasks;
  const isExpanded = expandedIds.has(task.id);

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <TaskCardBody
        {...shared}
        task={task}
        handleRef={handleRef}
        dragging={isDragSource}
        isOverlay={isOverlay}
        isPending={isPending(task.id)}
        moveTargets={moveTargets}
        reorder={{ index, columnLength, onReorder }}
        onDuplicate={onDuplicate}
        onMoveToList={onMoveToList}
        {...(subtasks.length === 0
          ? {}
          : {
              isExpanded,
              onToggleExpand: () => {
                onToggleExpand(task.id);
              },
            })}
      />

      {/*
        Subtasks, indented and rendered with the same body as their parent —
        so a status, priority, due date or assignee change on a subtask is the
        same gesture in the same place, rather than a trip to the drawer
        (Requirement 5.7, 15.10).
      */}
      {isExpanded && subtasks.length > 0 && (
        <ul className="ml-4 flex flex-col gap-2 border-l border-border pl-2">
          {subtasks.map((subtask) => (
            <li key={subtask.id}>
              <TaskCardBody
                {...shared}
                task={subtask}
                isSubtask
                isPending={isPending(subtask.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface TaskCardBodyProps {
  readonly task: TaskCardViewModel;
  readonly now: string;
  readonly canEdit: boolean;
  readonly readOnlyReason?: string | undefined;
  readonly statuses: readonly TaskCardStatusOption[];
  readonly members: readonly AvatarGroupMember[];
  readonly isPending: boolean;
  /** Set on a subtask body: indents it and narrows its menu. */
  readonly isSubtask?: boolean;
  readonly isOverlay?: boolean;
  readonly dragging?: boolean;
  /** dnd-kit's handle ref. Only the parent body is the drag activator. */
  readonly handleRef?: (element: Element | null) => void;
  /** Absent on a subtask, which cannot be moved between lists or columns. */
  readonly moveTargets?: readonly { id: string; name: string }[];
  readonly reorder?:
    | {
        readonly index: number;
        readonly columnLength: number;
        readonly onReorder: (taskId: string, toIndex: number) => void;
      }
    | undefined;
  /** Absent when this task has no children to reveal. */
  readonly isExpanded?: boolean;
  readonly onToggleExpand?: (() => void) | undefined;
  readonly onOpen: (taskId: string) => void;
  readonly onToggleComplete: (taskId: string) => void;
  readonly onRename: (taskId: string, title: string) => void;
  readonly onSetPriority: (taskId: string, priority: string) => void;
  readonly onSetStatus: (taskId: string, statusId: string) => void;
  readonly onToggleAssignee: (taskId: string, userId: string) => void;
  readonly onSetDueDate: (taskId: string, dueDate: string | null) => void;
  readonly onDuplicate?: ((taskId: string) => void) | undefined;
  readonly onMoveToList?:
    | ((taskId: string, listId: string) => void)
    | undefined;
  readonly onDelete: (taskId: string) => void;
}

/**
 * One card's presentation and editing, parent or subtask.
 *
 * What a subtask does **not** get is a short, specific list, and each omission
 * is a Controller guard rather than a style choice:
 *
 *   - *Move to list* — `moveToList` rejects a subtask outright with "Move the
 *     parent task instead", because a subtask must stay in its parent's list.
 *   - *Move up / move down* — `move` computes position against
 *     `columnTasks`, which filters to `parentTaskId === null`, so a subtask has
 *     no column position for an index to mean anything about.
 *   - *Duplicate* — valid, but it would land the copy at a position derived
 *     from that same top-level list. Omitted rather than shipped subtly wrong.
 *
 * Everything else — rename, status, priority, due date, assignees, complete,
 * delete — is legal on a subtask and present here, which is what makes this
 * the same editing surface as the parent rather than a lookalike.
 */
function TaskCardBody({
  task,
  now,
  canEdit,
  readOnlyReason,
  statuses,
  members,
  isPending,
  isSubtask = false,
  isOverlay = false,
  dragging = false,
  handleRef,
  moveTargets = [],
  reorder,
  isExpanded = false,
  onToggleExpand,
  onOpen,
  onToggleComplete,
  onRename,
  onSetPriority,
  onSetStatus,
  onToggleAssignee,
  onSetDueDate,
  onDuplicate,
  onMoveToList,
  onDelete,
}: TaskCardBodyProps) {
  const index = reorder?.index ?? 0;
  const columnLength = reorder?.columnLength ?? 1;

  /*
   * Split in two on purpose.
   *
   * Only the two reorder entries depend on `index` and `columnLength`, and a
   * crossing shifts the index of every card below the insertion point in both
   * columns. Keeping them in one memo meant each of those cards rebuilt
   * twenty-odd items — including JSX for every status and member — to change
   * two disabled flags.
   */
  const stableItems = useMemo((): MenuItemSpec[] => {
    const statusItems: MenuItemSpec[] = statuses
      .filter((status) => status.id !== task.statusId)
      .map((status) => ({
        id: `status-${status.id}`,
        label: `Move to ${status.name}`,
        content: (
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-ink-400">Move to</span>
            <StatusPill
              name={status.name}
              colorToken={status.colorToken}
              variant="dot-label"
            />
          </span>
        ),
        disabled: !canEdit,
        disabledReason: readOnlyReason,
        onSelect: () => {
          onSetStatus(task.id, status.id);
        },
      }));

    const priorityItems: MenuItemSpec[] = PRIORITIES.filter(
      (priority) => priority !== task.priority,
    ).map((priority, index) => ({
      id: `priority-${priority}`,
      label: `Priority: ${PRIORITY_CONFIG[priority].label}`,
      icon: PRIORITY_CONFIG[priority].icon,
      disabled: !canEdit,
      disabledReason: readOnlyReason,
      separatorBefore: index === 0,
      onSelect: () => {
        onSetPriority(task.id, priority);
      },
    }));

    const assignedIds = new Set(task.assignees.map((user) => user.id));

    /*
     * Assigning from the card, rather than only from the drawer, is the point
     * of a quick-action menu: triaging a column should not need six drawer
     * round-trips (Requirement 15.2, 15.10).
     */
    const assigneeItems: MenuItemSpec[] = members
      .slice(0, MAX_MENU_MEMBERS)
      .map((member, position) => ({
        id: `assignee-${member.id}`,
        label: assignedIds.has(member.id)
          ? `Unassign ${member.name}`
          : `Assign ${member.name}`,
        icon: assignedIds.has(member.id) ? UserMinus : UserPlus,
        disabled: !canEdit,
        disabledReason: readOnlyReason,
        separatorBefore: position === 0,
        onSelect: () => {
          onToggleAssignee(task.id, member.id);
        },
      }));

    const dueDateItems: MenuItemSpec[] = [
      ...DUE_DATE_PRESETS.map((preset, position) => ({
        id: `due-${preset.id}`,
        label: `Due ${preset.label.toLowerCase()}`,
        icon: CalendarClock,
        disabled: !canEdit,
        disabledReason: readOnlyReason,
        separatorBefore: position === 0,
        onSelect: () => {
          onSetDueDate(task.id, dueDateAtDays(now, preset.days));
        },
      })),
      ...(task.dueDate === null
        ? []
        : [
            {
              id: "due-clear",
              label: "Clear due date",
              icon: CalendarOff,
              disabled: !canEdit,
              disabledReason: readOnlyReason,
              onSelect: () => {
                onSetDueDate(task.id, null);
              },
            },
          ]),
    ];

    /* Both of these are refused for a subtask — see this component's note. */
    const listItems: MenuItemSpec[] =
      isSubtask || onMoveToList === undefined
        ? []
        : moveTargets.slice(0, MAX_MENU_LISTS).map((list, position) => ({
            id: `list-${list.id}`,
            label: `Move to "${list.name}"`,
            icon: CornerUpRight,
            disabled: !canEdit,
            disabledReason: readOnlyReason,
            separatorBefore: position === 0,
            onSelect: () => {
              onMoveToList(task.id, list.id);
            },
          }));

    const duplicateItems: MenuItemSpec[] =
      isSubtask || onDuplicate === undefined
        ? []
        : [
            {
              id: "duplicate",
              label: "Duplicate",
              icon: Copy,
              disabled: !canEdit,
              disabledReason: readOnlyReason,
              separatorBefore: true,
              onSelect: () => {
                onDuplicate(task.id);
              },
            },
          ];

    return [
      {
        id: "open",
        label: "Open details",
        icon: FileText,
        onSelect: () => {
          onOpen(task.id);
        },
      },
      ...statusItems.map((item, position) => ({
        ...item,
        separatorBefore: position === 0,
      })),
      ...priorityItems,
      ...assigneeItems,
      ...dueDateItems,
      ...listItems,
      ...duplicateItems,
      {
        id: "delete",
        label: isSubtask ? "Delete subtask" : "Delete task",
        icon: Trash2,
        tone: "danger",
        disabled: !canEdit,
        disabledReason: readOnlyReason,
        separatorBefore: duplicateItems.length === 0,
        onSelect: () => {
          onDelete(task.id);
        },
      },
    ];
  }, [
    task,
    now,
    statuses,
    moveTargets,
    members,
    canEdit,
    readOnlyReason,
    isSubtask,
    onOpen,
    onSetStatus,
    onSetPriority,
    onToggleAssignee,
    onSetDueDate,
    onMoveToList,
    onDuplicate,
    onDelete,
  ]);

  /*
   * Reordering has to be reachable without dragging at all. A long-press drag
   * is awkward on a phone and impossible with some assistive technology, so
   * the same move exists as two menu items (Requirement 4.11, 15.10, 20.8).
   *
   * `toIndex` is an index into the column with this task already removed,
   * which is why moving down targets `index + 1` rather than `index + 2`.
   */
  const items = useMemo((): MenuItemSpec[] => {
    // A subtask has no column position, so there is no index to move it to.
    if (reorder === undefined || isSubtask) return stableItems;

    const { onReorder } = reorder;

    const reorderItems: MenuItemSpec[] = [
      {
        id: "move-up",
        label: "Move up",
        icon: ArrowUp,
        disabled: !canEdit || index === 0,
        // Two different refusals: no permission, or nowhere further to go.
        disabledReason: canEdit ? "Already first" : readOnlyReason,
        separatorBefore: true,
        onSelect: () => {
          onReorder(task.id, index - 1);
        },
      },
      {
        id: "move-down",
        label: "Move down",
        icon: ArrowDown,
        disabled: !canEdit || index >= columnLength - 1,
        disabledReason: canEdit ? "Already last" : readOnlyReason,
        onSelect: () => {
          onReorder(task.id, index + 1);
        },
      },
    ];

    // Spliced in before the move-to-list entries, where they read as part of
    // the same "where does this go" group.
    const listAt = stableItems.findIndex((item) => item.id.startsWith("list-"));
    const at = listAt === -1 ? stableItems.length - 2 : listAt;

    return [
      ...stableItems.slice(0, at),
      ...reorderItems,
      ...stableItems.slice(at),
    ];
  }, [
    stableItems,
    task.id,
    index,
    columnLength,
    canEdit,
    readOnlyReason,
    isSubtask,
    reorder,
  ]);

  /*
   * Clicking the card body opens the drawer, but a click on a control inside it
   * must not also open it. Rather than `stopPropagation` on every child, the
   * handler checks whether the event originated from an interactive descendant
   * — one place, and it cannot be forgotten when a control is added
   * (Requirement 15.4).
   */
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const interactive = (event.target as HTMLElement).closest(
      "button, a, input, label, [role='menu'], [role='menuitem']",
    );

    if (interactive) return;

    onOpen(task.id);
  }

  /*
   * Enter opens the drawer, and that is all this handler is for.
   *
   * Space picks up and drops and Escape cancels, but neither passes through
   * here any more: dnd-kit's keyboard sensor binds its own listener to this
   * element, and its default activation guard already refuses any event whose
   * target is not the element itself. That guard is the thing the previous
   * implementation hand-rolled, badly — forwarding every keystroke to the
   * activator meant typing a space into the card's inline title field started
   * a drag and swallowed the character, so "Define the onboarding checklist"
   * committed as "Definetheonboardingchecklist".
   *
   * The target check is still needed on *our* side, so Enter in the title
   * field commits the title instead of opening the drawer behind it
   * (Requirement 4.11, 15.4, 17.5).
   */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.defaultPrevented) return;

    if (event.key === "Enter") {
      event.preventDefault();
      onOpen(task.id);
    }
  }

  return (
    <Card
      /*
       * No inline transform style any more, and the px-exception that went
       * with it is gone too (Requirement 13.4, 22.4). dnd-kit now writes the
       * per-frame transform straight to this element outside of React, which
       * is precisely why a drag no longer re-renders the board.
       */
      /*
       * Only a parent body is the drag handle; a subtask has no ref to take,
       * which is why this is conditional rather than always spread.
       */
      {...(handleRef === undefined ? {} : { ref: handleRef })}
      interactive
      elevated
      /*
       * `isDragSource` rather than `isDragging`: it stays true through the
       * drop animation, so the slot the card came from does not flash back to
       * full opacity for a frame while the clone is still flying into place
       * (Requirement 15.6).
       */
      dragging={dragging}
      overlay={isOverlay}
      pending={isPending}
      /* Denser, so a parent and its children read as a group not a stack. */
      padding={isSubtask ? "sm" : "md"}
      /*
       * On a parent, `role`, `tabIndex`, `aria-roledescription` and
       * `aria-describedby` are applied to this element by dnd-kit's
       * accessibility plugin — it is the drag handle — which is why they are
       * not spread here. A subtask is not draggable, so it gets the two it
       * needs to stay keyboard-reachable and Enter-openable itself
       * (Requirement 15.5, 17.1).
       */
      {...(isSubtask ? { role: "button", tabIndex: 0 } : {})}
      aria-label={task.title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group cursor-pointer select-none",
        isOverlay && "cursor-grabbing",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="-mt-0.5 shrink-0">
          <Checkbox
            checked={task.isComplete}
            label={`Mark "${task.title}" complete`}
            labelHidden
            disabled={!canEdit}
            onChange={() => {
              onToggleComplete(task.id);
            }}
          />
        </span>

        {/*
          Click-to-edit, rather than a label that sends you to the drawer to
          change one word. `singleLine` so Enter commits: a title is not prose,
          and ⌘/Ctrl+Enter is not a shortcut anyone discovers on a card.
          `key` resets the draft when the card is reused for another task.
        */}
        <span className="min-w-0 flex-1">
          <InlineTextField
            key={`title-${task.id}`}
            label="Title"
            value={task.title}
            placeholder="Untitled task"
            disabled={!canEdit}
            singleLine
            maxLength={MAX_TITLE_LEN}
            textClassName={cn(
              // Two lines, then ellipsis. The full title is in the drawer
              // (Requirement 15.9).
              "line-clamp-2 text-sm text-ink-900",
              task.isComplete && "text-ink-400 line-through",
            )}
            onCommit={(next) => {
              if (next.trim().length > 0) onRename(task.id, next.trim());
            }}
          />
        </span>

        <span
          className={cn(
            "shrink-0",
            "can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100",
          )}
        >
          <Menu
            align="end"
            label={`Actions for ${task.title}`}
            items={items}
            trigger={
              <IconButton
                icon={MoreHorizontal}
                label={`Actions for ${task.title}`}
                size="xs"
                tooltip={false}
              />
            }
          />
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {/*
          Priority, date and assignees are all editable from the card itself.
          The card's own click handler ignores events from `button` descendants,
          so opening a picker does not also open the drawer
          (Requirement 15.4).
        */}
        <PriorityPicker
          value={task.priority}
          disabled={!canEdit}
          disabledReason={readOnlyReason}
          onChange={(priority) => {
            onSetPriority(task.id, priority);
          }}
        />

        {/*
          The count *is* the disclosure.

          It used to be an inert chip with a tooltip, which told you a card had
          two subtasks and then gave you nowhere to go — the drawer was the
          only way to see or change one. Making the same chip the toggle adds
          the affordance without adding an element, and it keeps the progress
          reading visible whether the children are open or shut.

          Labelled to match the list view's table exactly, so "expand the
          subtasks of X" is one phrase across both surfaces.
        */}
        {task.subtaskCount > 0 && onToggleExpand !== undefined && (
          <Tooltip
            content={`${String(task.completedSubtaskCount)} of ${String(task.subtaskCount)} subtasks complete`}
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={
                isExpanded
                  ? `Collapse subtasks of ${task.title}`
                  : `Expand subtasks of ${task.title}`
              }
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand();
              }}
              className={cn(
                "flex items-center gap-0.5 rounded text-xs tabular-nums",
                // A 1rem target is not tappable; the board is touch-first.
                "coarse-pointer:min-h-touch coarse-pointer:px-1",
                "text-ink-400 can-hover:hover:text-ink-900",
                "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-1",
              )}
            >
              <ChevronRight
                className={cn(
                  "size-icon-sm transition-transform motion-reduce:transition-none",
                  isExpanded && "rotate-90",
                )}
                strokeWidth={2}
                aria-hidden
              />
              <ListTree
                className="size-icon-sm"
                strokeWidth={1.75}
                aria-hidden
              />
              {task.completedSubtaskCount}/{task.subtaskCount}
            </button>
          </Tooltip>
        )}

        {/* No toggle to offer: a subtask cannot itself have children. */}
        {task.subtaskCount > 0 && onToggleExpand === undefined && (
          <Tooltip
            content={`${String(task.completedSubtaskCount)} of ${String(task.subtaskCount)} subtasks complete`}
          >
            <span className="flex items-center gap-0.5 text-xs tabular-nums text-ink-400">
              <ListTree
                className="size-icon-sm"
                strokeWidth={1.75}
                aria-hidden
              />
              {task.completedSubtaskCount}/{task.subtaskCount}
            </span>
          </Tooltip>
        )}

        {task.hasDescription && (
          <Tooltip content="Has a description">
            <FileText
              className="size-icon-sm shrink-0 text-ink-300"
              strokeWidth={1.75}
              aria-hidden
            />
          </Tooltip>
        )}

        <DueDatePicker
          value={task.dueDate}
          now={now}
          disabled={!canEdit}
          disabledReason={readOnlyReason}
          onChange={(dueDate) => {
            onSetDueDate(task.id, dueDate);
          }}
        />

        <span className="ml-auto shrink-0">
          <AssigneePicker
            assignees={task.assignees}
            members={members}
            disabled={!canEdit}
            disabledReason={readOnlyReason}
            onToggle={(userId) => {
              onToggleAssignee(task.id, userId);
            }}
          />
        </span>
      </div>
    </Card>
  );
}

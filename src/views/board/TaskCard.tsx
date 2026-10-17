import {
  defaultAnimateLayoutChanges,
  useSortable,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarOff,
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

/**
 * Animate layout changes even for a card that has just arrived in a column.
 *
 * dnd-kit's default bails out when `wasDragging` is false, which is the case
 * for a card newly mounted into another column's `SortableContext` — so the
 * cards above and below it snapped into their new places instead of sliding.
 * That snap, at both ends of a cross-column drag, is what read as jerky.
 *
 * Forcing the flag is the remedy dnd-kit's own multiple-containers example
 * uses; everything else about the default predicate is kept.
 */
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

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
  /** A mutation on this task is in flight (Requirement 14.7). */
  readonly isPending?: boolean;
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
 * A drag re-renders the board on every pointer event, and each card carries
 * four pickers, a twenty-item menu and several tooltips. Rebuilding all of
 * them continuously is what made dragging feel heavy. This is only effective
 * because the board now hands down stable callbacks — with inline arrows the
 * props differed every render and this wrapper would have cost a comparison
 * and saved nothing.
 */
export const TaskCard = memo(TaskCardImpl);

function TaskCardImpl({
  task,
  now,
  canEdit,
  readOnlyReason,
  statuses,
  moveTargets,
  members,
  index,
  columnLength,
  isOverlay = false,
  isPending = false,
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task" },
    disabled: !canEdit || isOverlay,
    animateLayoutChanges,
  });

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

    const listItems: MenuItemSpec[] = moveTargets
      .slice(0, MAX_MENU_LISTS)
      .map((list, position) => ({
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
      {
        id: "delete",
        label: "Delete task",
        icon: Trash2,
        tone: "danger",
        disabled: !canEdit,
        disabledReason: readOnlyReason,
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
    onReorder,
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
   * dnd-kit registers its keyboard activator as `onKeyDown` inside
   * `listeners`. Spreading `listeners` and then setting our own `onKeyDown`
   * replaces it — which silently disabled keyboard dragging while
   * `aria-roledescription="sortable"` went on advertising it. Composing is the
   * fix: dnd-kit sees the event first, and we only act on what it ignored.
   *
   * The cast is needed because dnd-kit types its listener map as
   * `Record<string, Function>`, which carries no parameter information.
   */
  const startDrag = listeners?.["onKeyDown"] as
    | ((event: KeyboardEvent<HTMLDivElement>) => void)
    | undefined;

  /*
   * Space picks up and drops, Escape cancels, Enter opens the drawer. The
   * board narrows dnd-kit's `start`/`end` codes to Space precisely so Enter
   * means one thing here (Requirement 4.11, 15.4, 17.5).
   */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    /*
     * The target check comes *first*, and that ordering is the whole point.
     *
     * dnd-kit's keyboard activator fires on Space. Forwarding every keystroke
     * to it meant typing a space into the card's inline title field started a
     * drag and swallowed the character — "Define the onboarding checklist"
     * committed as "Definetheonboardingchecklist". A drag should only ever
     * begin from the card itself, never from something focused inside it.
     */
    if (event.target !== event.currentTarget) return;

    startDrag?.(event);

    if (event.defaultPrevented) return;

    if (event.key === "Enter") {
      event.preventDefault();
      onOpen(task.id);
    }
  }

  return (
    <Card
      ref={setNodeRef}
      /*
       * dnd-kit's per-frame transform — one of the three documented inline
       * `style` exceptions (Requirement 13.4). px-exception: these are the
       * library's own pixel offsets, not an authored dimension.
       */
      style={
        isOverlay
          ? undefined
          : { transform: CSS.Transform.toString(transform), transition }
      }
      interactive
      elevated
      dragging={isDragging}
      overlay={isOverlay}
      pending={isPending}
      padding="md"
      /*
       * dnd-kit's attributes come first and already supply `role="button"`,
       * `tabIndex` and `aria-roledescription` — the keyboard affordances the
       * drag needs. Setting our own after would silently override them, which
       * is what TypeScript flagged. Only `aria-label` is added on top, since
       * dnd-kit cannot know the task's title (Requirement 15.5).
       */
      {...attributes}
      {...listeners}
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

        {task.subtaskCount > 0 && (
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

import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { Fragment } from "react";

import { AssigneePicker } from "@/components/ui/AssigneePicker";
import type { AvatarGroupMember } from "@/components/ui/AvatarGroup";
import { Checkbox } from "@/components/ui/Checkbox";
import { DueDatePicker } from "@/components/ui/DueDatePicker";
import { InlineTextField } from "@/components/ui/InlineTextField";
import { PriorityPicker } from "@/components/ui/PriorityPicker";
import {
  StatusPicker,
  type StatusPickerOption,
} from "@/components/ui/StatusPicker";
import { MAX_TITLE_LEN } from "@/config/limits";
import type { Priority } from "@/config/priorities";
import type { TaskRowViewModel } from "@/controllers/hooks/useTaskTable";
import { cn } from "@/lib/cn";
import type { SortField, SortState } from "@/model/types";

export interface TaskTableProps {
  readonly rows: readonly TaskRowViewModel[];
  readonly now: string;
  readonly sort: SortState;
  readonly canEdit: boolean;
  /** Why editing is refused, for the inline pickers (Requirement 8.11). */
  readonly readOnlyReason?: string | undefined;
  /** Whether a mutation on a given task is in flight (Requirement 14.7). */
  readonly isPending: (taskId: string) => boolean;
  /** The list's full status set, so a row's pill can become a picker. */
  readonly statuses: readonly StatusPickerOption[];
  readonly members: readonly AvatarGroupMember[];
  readonly expandedIds: ReadonlySet<string>;
  readonly onSortChange: (field: SortField) => void;
  readonly onOpen: (taskId: string) => void;
  readonly onToggleComplete: (taskId: string) => void;
  readonly onToggleExpand: (taskId: string) => void;
  readonly onRename: (taskId: string, title: string) => void;
  readonly onSetStatus: (taskId: string, statusId: string) => void;
  readonly onSetPriority: (taskId: string, priority: Priority) => void;
  readonly onSetDueDate: (taskId: string, dueDate: string | null) => void;
  readonly onToggleAssignee: (taskId: string, userId: string) => void;
}

/** Sort direction as `aria-sort` expects it, so the header speaks its state. */
const ARIA_SORT: Record<SortState["direction"], "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
};

const COLUMNS: readonly {
  readonly field: SortField | null;
  readonly label: string;
  readonly className: string;
}[] = [
  { field: "title", label: "Task", className: "w-auto" },
  { field: "status", label: "Status", className: "w-32" },
  { field: "priority", label: "Priority", className: "w-28" },
  { field: "dueDate", label: "Due", className: "w-28" },
  { field: null, label: "Assignees", className: "w-24" },
];

/**
 * The list view's table, from `md` upward.
 *
 * Real table semantics rather than a grid of divs, so a screen reader can
 * navigate by row and column and the sortable headers can expose their
 * direction through `aria-sort` (Requirement 5.1, 17.4).
 */
export function TaskTable({
  rows,
  now,
  sort,
  canEdit,
  readOnlyReason,
  isPending,
  statuses,
  members,
  expandedIds,
  onSortChange,
  onOpen,
  onToggleComplete,
  onToggleExpand,
  onRename,
  onSetStatus,
  onSetPriority,
  onSetDueDate,
  onToggleAssignee,
}: TaskTableProps) {
  function renderRow(row: TaskRowViewModel, depth: number) {
    const isExpanded = expandedIds.has(row.task.id);
    const hasSubtasks = row.subtasks.length > 0;

    return (
      // The key belongs on the outermost element returned from the map, which
      // is the fragment — not on the `tr` nested inside it.
      <Fragment key={row.task.id}>
        <tr
          aria-busy={isPending(row.task.id) || undefined}
          /*
           * The row opens the drawer, but a click on a control inside it must
           * not. This previously relied on each child remembering to call
           * `stopPropagation` — which held only while the cells were inert
           * text. The moment the status pill, priority badge, date chip and
           * avatars became buttons, every one of them opened the drawer behind
           * its own popover. Filtering interactive descendants in one place is
           * what the cards already do, and it cannot be forgotten when a
           * control is added (Requirement 15.4).
           */
          onClick={(event) => {
            const interactive = (event.target as HTMLElement).closest(
              "button, a, input, label, [role='menu'], [role='menuitem'], [role='dialog']",
            );

            if (interactive) return;

            onOpen(row.task.id);
          }}
          className={cn(
            "cursor-pointer border-b border-border",
            "transition-colors motion-reduce:transition-none",
            "can-hover:hover:bg-surface-hover",
            // Subdued at the row that was acted on (Requirement 14.7).
            isPending(row.task.id) && "opacity-60",
          )}
        >
          <td className="h-11 px-3 density-compact:h-9">
            <div className={cn("flex items-center gap-2", depth > 0 && "pl-6")}>
              <span
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <Checkbox
                  checked={row.task.isComplete}
                  label={`Mark "${row.task.title}" complete`}
                  labelHidden
                  disabled={!canEdit}
                  onChange={() => {
                    onToggleComplete(row.task.id);
                  }}
                />
              </span>

              {hasSubtasks ? (
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-label={
                    isExpanded
                      ? `Collapse subtasks of ${row.task.title}`
                      : `Expand subtasks of ${row.task.title}`
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExpand(row.task.id);
                  }}
                  className={cn(
                    // The table renders from `md`, which includes tablets —
                    // a coarse pointer at a wide viewport. A 1rem chevron is
                    // not tappable there (Requirement 20.9).
                    "flex shrink-0 items-center justify-center rounded",
                    "size-icon-md coarse-pointer:size-touch",
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
                  />
                </button>
              ) : (
                <span className="size-icon-sm shrink-0" />
              )}

              {/*
                Click-to-edit in the cell. The row's own click opens the
                drawer, and the handler ignores events from `button`
                descendants — which the field's read mode is — so the two do
                not fight (Requirement 15.4).
              */}
              <span className="min-w-0 flex-1">
                <InlineTextField
                  key={`title-${row.task.id}`}
                  label="Title"
                  value={row.task.title}
                  placeholder="Untitled task"
                  disabled={!canEdit}
                  singleLine
                  maxLength={MAX_TITLE_LEN}
                  textClassName={cn(
                    "truncate text-sm text-ink-900",
                    row.task.isComplete && "text-ink-400 line-through",
                  )}
                  onCommit={(next) => {
                    if (next.trim().length > 0)
                      onRename(row.task.id, next.trim());
                  }}
                />
              </span>
            </div>
          </td>

          {/*
            The pill is the control — no chevron, because a caret on every row
            would make the table read as a form rather than as data. The
            affordance is the hover and focus highlight instead.
          */}
          <td className="px-3">
            <StatusPicker
              value={row.statusId}
              options={statuses}
              disabled={!canEdit}
              disabledReason={readOnlyReason}
              onChange={(statusId) => {
                onSetStatus(row.task.id, statusId);
              }}
            />
          </td>

          <td className="px-3">
            <PriorityPicker
              value={row.task.priority}
              showLabel
              disabled={!canEdit}
              disabledReason={readOnlyReason}
              onChange={(priority) => {
                onSetPriority(row.task.id, priority);
              }}
            />
          </td>

          <td className="px-3">
            <DueDatePicker
              value={row.task.dueDate}
              now={now}
              disabled={!canEdit}
              disabledReason={readOnlyReason}
              onChange={(dueDate) => {
                onSetDueDate(row.task.id, dueDate);
              }}
            />
          </td>

          <td className="px-3">
            <AssigneePicker
              assignees={row.task.assignees}
              members={members}
              max={2}
              disabled={!canEdit}
              disabledReason={readOnlyReason}
              onToggle={(userId) => {
                onToggleAssignee(row.task.id, userId);
              }}
            />
          </td>
        </tr>

        {/*
          Subtasks render nested under their parent and never at the top level,
          so the table reflects the hierarchy rather than flattening it
          (Requirement 5.7).
        */}
        {isExpanded &&
          row.subtasks.map((subtask) => renderRow(subtask, depth + 1))}
      </Fragment>
    );
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead className="sticky top-0 z-10 bg-surface-sunken">
        <tr className="border-b border-border">
          {COLUMNS.map((column) => {
            const isActive =
              column.field !== null && sort.field === column.field;

            return (
              <th
                key={column.label}
                scope="col"
                aria-sort={isActive ? ARIA_SORT[sort.direction] : undefined}
                className={cn(
                  "h-9 px-3 text-xs font-medium text-ink-400",
                  column.className,
                )}
              >
                {column.field === null ? (
                  column.label
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      // Narrowed by the ternary, but the closure loses it.
                      if (column.field !== null) onSortChange(column.field);
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded",
                      "coarse-pointer:min-h-touch",
                      "can-hover:hover:text-ink-900",
                      "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2",
                      isActive && "text-ink-900",
                    )}
                  >
                    {column.label}
                    {isActive &&
                      (sort.direction === "asc" ? (
                        <ArrowUp
                          className="size-icon-sm"
                          strokeWidth={2}
                          aria-hidden
                        />
                      ) : (
                        <ArrowDown
                          className="size-icon-sm"
                          strokeWidth={2}
                          aria-hidden
                        />
                      ))}
                  </button>
                )}
              </th>
            );
          })}
        </tr>
      </thead>

      <tbody>{rows.map((row) => renderRow(row, 0))}</tbody>
    </table>
  );
}

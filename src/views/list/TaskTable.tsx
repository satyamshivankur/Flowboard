import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { Fragment } from "react";

import { AvatarGroup } from "@/components/ui/AvatarGroup";
import { Checkbox } from "@/components/ui/Checkbox";
import { DueDateChip } from "@/components/ui/DueDateChip";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import type { TaskRowViewModel } from "@/controllers/hooks/useTaskTable";
import { cn } from "@/lib/cn";
import type { SortField, SortState } from "@/model/types";

export interface TaskTableProps {
  readonly rows: readonly TaskRowViewModel[];
  readonly now: string;
  readonly sort: SortState;
  readonly canEdit: boolean;
  readonly expandedIds: ReadonlySet<string>;
  readonly onSortChange: (field: SortField) => void;
  readonly onOpen: (taskId: string) => void;
  readonly onToggleComplete: (taskId: string) => void;
  readonly onToggleExpand: (taskId: string) => void;
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
  expandedIds,
  onSortChange,
  onOpen,
  onToggleComplete,
  onToggleExpand,
}: TaskTableProps) {
  function renderRow(row: TaskRowViewModel, depth: number) {
    const isExpanded = expandedIds.has(row.task.id);
    const hasSubtasks = row.subtasks.length > 0;

    return (
      // The key belongs on the outermost element returned from the map, which
      // is the fragment — not on the `tr` nested inside it.
      <Fragment key={row.task.id}>
        <tr
          onClick={() => {
            onOpen(row.task.id);
          }}
          className={cn(
            "cursor-pointer border-b border-border",
            "transition-colors motion-reduce:transition-none",
            "can-hover:hover:bg-surface-hover",
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
                  className="shrink-0 rounded text-ink-400 can-hover:hover:text-ink-900"
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

              <span
                className={cn(
                  "truncate text-sm text-ink-900",
                  row.task.isComplete && "text-ink-400 line-through",
                )}
                title={row.task.title}
              >
                {row.task.title}
              </span>
            </div>
          </td>

          <td className="px-3">
            <StatusPill name={row.statusName} colorToken={row.statusToken} />
          </td>

          <td className="px-3">
            <PriorityBadge priority={row.task.priority} showLabel />
          </td>

          <td className="px-3">
            <DueDateChip date={row.task.dueDate} now={now} />
          </td>

          <td className="px-3">
            <AvatarGroup users={row.task.assignees} max={2} size="xs" />
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

import { ListTodo, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { ScrollShadow } from "@/components/ui/ScrollShadow";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Priority } from "@/config/priorities";
import { useNavigation } from "@/contexts/NavigationContext";
import { usePendingAction } from "@/controllers/hooks/usePendingAction";
import {
  useTaskTable,
  type TaskRowViewModel,
} from "@/controllers/hooks/useTaskTable";
import type { SortField, SortState } from "@/model/types";

import { ReadOnlyNotice } from "../states/ReadOnlyNotice";
import type { ViewProps } from "../viewComponents";

import { TaskCardList } from "./TaskCardList";
import { TaskTable } from "./TaskTable";

/**
 * Finds a row by task id, including nested subtask rows.
 *
 * A flat `find` over `rows` would miss every subtask, so toggling an assignee
 * on an expanded subtask row would silently do nothing.
 */
function findRow(
  rows: readonly TaskRowViewModel[],
  taskId: string,
): TaskRowViewModel | undefined {
  for (const row of rows) {
    if (row.task.id === taskId) return row;

    const nested = findRow(row.subtasks, taskId);

    if (nested !== undefined) return nested;
  }

  return undefined;
}

/** Sort options for the mobile dropdown — the same set the headers offer. */
const SORT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "dueDate:asc", label: "Due date — soonest" },
  { value: "dueDate:desc", label: "Due date — latest" },
  { value: "priority:asc", label: "Priority — highest" },
  { value: "priority:desc", label: "Priority — lowest" },
  { value: "title:asc", label: "Title — A to Z" },
  { value: "status:asc", label: "Status — first to last" },
];

export function TaskListView({ listId }: ViewProps) {
  // One reference time for the whole view, fixed at mount — see KanbanBoard.
  const now = useMemo(() => new Date().toISOString(), []);

  const [sort, setSort] = useState<SortState>({
    field: "dueDate",
    direction: "asc",
  });
  const [page, setPage] = useState(0);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const [composing, setComposing] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const table = useTaskTable(listId, sort, page, now);
  const { openTask } = useNavigation();
  // Keyed by task id, so the row that was ticked is the row that dims.
  const { run, isPending } = usePendingAction();

  const submitNewTask = useCallback(() => {
    const trimmed = newTitle.trim();

    setNewTitle("");
    setComposing(false);

    if (trimmed.length > 0) {
      void run(null, () => table.onCreate(trimmed), { retryable: true });
    }
  }, [newTitle, run, table]);

  /*
   * The inline editors on both forms of this view write through one set of
   * handlers, keyed by task id so the row that was edited is the row that
   * dims. Defined here rather than inside each form, which would have given
   * the table and the phone cards two subtly different sets
   * (Requirement 20.6).
   */
  const inlineHandlers = useMemo(
    () => ({
      onRename: (taskId: string, title: string) => {
        void run(taskId, () => table.onQuickUpdate(taskId, { title }), {
          retryable: true,
        });
      },
      onSetStatus: (taskId: string, statusId: string) => {
        void run(taskId, () => table.onQuickUpdate(taskId, { statusId }), {
          retryable: true,
        });
      },
      onSetPriority: (taskId: string, priority: Priority) => {
        void run(taskId, () => table.onQuickUpdate(taskId, { priority }), {
          retryable: true,
        });
      },
      onSetDueDate: (taskId: string, dueDate: string | null) => {
        void run(taskId, () => table.onQuickUpdate(taskId, { dueDate }), {
          retryable: true,
        });
      },
      onToggleAssignee: (taskId: string, userId: string) => {
        const row = findRow(table.rows, taskId);

        if (row === undefined) return;

        const current = row.task.assignees.map((user) => user.id);
        const next = current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId];

        void run(
          taskId,
          () => table.onQuickUpdate(taskId, { assigneeIds: next }),
          { retryable: true },
        );
      },
    }),
    [run, table],
  );

  /** Clicking the active column flips direction; a new column starts ascending. */
  const handleSortChange = useCallback((field: SortField) => {
    setSort((current) =>
      current.field === field
        ? {
            field,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { field, direction: "asc" },
    );
    setPage(0);
  }, []);

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }

      return next;
    });
  }, []);

  if (table.isLoading) {
    return (
      <div className="p-3 md:p-6">
        <Skeleton variant="row" lines={6} />
      </div>
    );
  }

  /*
   * The empty state carries the primary action rather than pointing at the
   * board, because sending someone to another view to do the obvious next
   * thing is not an empty state — it is a dead end (Requirement 5.9, 14.3).
   */
  if (table.isEmpty) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No tasks yet"
        description={
          table.canEdit
            ? "Add the first one, or drop a card into a board column."
            : "You don't have permission to add tasks to this list."
        }
        action={
          composing ? (
            <Input
              label="New task"
              labelHidden
              autoFocus
              value={newTitle}
              placeholder="Task title"
              onChange={(event) => {
                setNewTitle(event.target.value);
              }}
              onBlur={submitNewTask}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitNewTask();
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  setNewTitle("");
                  setComposing(false);
                }
              }}
            />
          ) : (
            <Button
              icon={Plus}
              size="sm"
              disabled={!table.canEdit}
              onClick={() => {
                setComposing(true);
              }}
            >
              New task
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReadOnlyNotice reason={table.readOnlyReason} subject="list" />

      {/*
        The sort dropdown replaces the table headers below `md`, offering the
        identical option set (Requirement 20.6).
      */}
      <div className="shrink-0 px-3 pt-3 md:hidden">
        <Select
          label="Sort by"
          value={`${sort.field}:${sort.direction}`}
          options={SORT_OPTIONS}
          onChange={(value) => {
            const [field, direction] = value.split(":");

            setSort({
              field: field as SortField,
              direction: direction === "desc" ? "desc" : "asc",
            });
            setPage(0);
          }}
        />
      </div>

      <ScrollShadow className="px-3 py-3 md:px-6 md:py-0">
        <div className="md:hidden">
          <TaskCardList
            rows={table.rows}
            now={now}
            canEdit={table.canEdit}
            readOnlyReason={table.readOnlyReason}
            isPending={isPending}
            statuses={table.statuses}
            members={table.members}
            onOpen={openTask}
            onToggleComplete={(taskId) => {
              void run(taskId, () => table.onToggleComplete(taskId), {
                retryable: true,
              });
            }}
            {...inlineHandlers}
          />
        </div>

        <div className="hidden md:block">
          <TaskTable
            rows={table.rows}
            now={now}
            sort={sort}
            canEdit={table.canEdit}
            readOnlyReason={table.readOnlyReason}
            isPending={isPending}
            statuses={table.statuses}
            members={table.members}
            expandedIds={expandedIds}
            onSortChange={handleSortChange}
            onOpen={openTask}
            onToggleComplete={(taskId) => {
              void run(taskId, () => table.onToggleComplete(taskId), {
                retryable: true,
              });
            }}
            onToggleExpand={toggleExpand}
            {...inlineHandlers}
          />
        </div>

        {/*
          Simulated offset pagination over in-memory rows. Cumulative, because
          the control is "load more" rather than numbered pages
          (Requirement 9.12).
        */}
        {table.hasMore && (
          <div className="flex justify-center py-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setPage((current) => current + 1);
              }}
            >
              Load more ({table.rows.length} of {table.total})
            </Button>
          </div>
        )}
      </ScrollShadow>
    </div>
  );
}

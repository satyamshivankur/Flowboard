import { ListTodo, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { ScrollShadow } from "@/components/ui/ScrollShadow";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNavigation } from "@/contexts/NavigationContext";
import { useAction } from "@/controllers/hooks/useAction";
import { useTaskTable } from "@/controllers/hooks/useTaskTable";
import type { SortField, SortState } from "@/model/types";

import type { ViewProps } from "../viewComponents";

import { TaskCardList } from "./TaskCardList";
import { TaskTable } from "./TaskTable";

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
  const { run } = useAction();

  const submitNewTask = useCallback(() => {
    const trimmed = newTitle.trim();

    setNewTitle("");
    setComposing(false);

    if (trimmed.length > 0) void run(() => table.onCreate(trimmed), { retryable: true });
  }, [newTitle, run, table]);

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
            onOpen={openTask}
            onToggleComplete={(taskId) => {
              void run(() => table.onToggleComplete(taskId), { retryable: true });
            }}
          />
        </div>

        <div className="hidden md:block">
          <TaskTable
            rows={table.rows}
            now={now}
            sort={sort}
            canEdit={table.canEdit}
            expandedIds={expandedIds}
            onSortChange={handleSortChange}
            onOpen={openTask}
            onToggleComplete={(taskId) => {
              void run(() => table.onToggleComplete(taskId), { retryable: true });
            }}
            onToggleExpand={toggleExpand}
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

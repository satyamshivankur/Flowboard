import { ListTodo } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { useTaskTable } from "@/controllers/hooks/useTaskTable";
import type { SortState } from "@/model/types";

import type { ViewProps } from "../viewComponents";

/**
 * The list view.
 *
 * **Phase 5 placeholder.** Rows come from `useTaskTable` against real
 * selectors, so sorting and permission filtering are already live. The full
 * table with sortable headers, nested subtask rows, the card form below `md`
 * and pagination are Phase 6.
 */
export function TaskListView({ listId }: ViewProps) {
  const [sort] = useState<SortState>({ field: "dueDate", direction: "asc" });
  const table = useTaskTable(listId, sort, 0);

  if (table.isLoading) {
    return (
      <div className="p-3 md:p-6">
        <Skeleton variant="row" lines={6} />
      </div>
    );
  }

  if (table.isEmpty) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No tasks yet"
        description="Create the first task in this list to get started."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 md:p-6">
      {table.rows.map((row) => (
        <div
          key={row.task.id}
          className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2 ring-1 ring-border"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
            {row.task.title}
          </span>
          <PriorityBadge priority={row.task.priority} />
          <StatusPill
            name={row.statusName}
            colorToken={row.statusToken}
            variant="dot"
          />
        </div>
      ))}
    </div>
  );
}

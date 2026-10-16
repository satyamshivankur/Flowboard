import { Columns3 } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { useBoard } from "@/controllers/hooks/useBoard";
import { cn } from "@/lib/cn";

import type { ViewProps } from "../viewComponents";

/**
 * The kanban board.
 *
 * **Phase 5 placeholder.** The chrome, the view registry and `useBoard` are all
 * wired — the column names and task counts below come from real selectors
 * against the real store, so switching user visibly changes them. Cards,
 * drag-and-drop and the quick-action menu are Phase 6.
 *
 * Rendering the live column data rather than a static "coming soon" is
 * deliberate: it makes the sidebar, permissions and list switching genuinely
 * demonstrable now, instead of deferring the first visible proof to Phase 6.
 */
export function KanbanBoard({ listId }: ViewProps) {
  const board = useBoard(listId);

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
    <div
      className={cn(
        "flex h-full gap-3 overflow-x-auto p-3",
        // Mobile: one column at a time with scroll-snap paging. From md, the
        // same columns side by side — no JavaScript breakpoint involved.
        "snap-x snap-mandatory md:snap-none md:gap-4 md:p-6",
      )}
    >
      {board.columns.map((column) => (
        <section
          key={column.statusId}
          className="flex w-column-mobile shrink-0 snap-center flex-col gap-2 md:w-column"
          aria-label={column.name}
        >
          <header className="flex items-center justify-between gap-2 px-1">
            <StatusPill
              name={column.name}
              colorToken={column.colorToken}
              variant="dot-label"
            />
            <span className="text-xs font-medium tabular-nums text-ink-400">
              {column.count}
            </span>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {column.tasks.length === 0 ? (
              <EmptyState
                icon={Columns3}
                title="No tasks"
                size="sm"
                isDropTarget
              />
            ) : (
              column.tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg bg-surface p-3 text-sm text-ink-900 shadow-card ring-1 ring-border"
                >
                  {task.title}
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

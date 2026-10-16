import { AvatarGroup } from "@/components/ui/AvatarGroup";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { DueDateChip } from "@/components/ui/DueDateChip";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import type { TaskRowViewModel } from "@/controllers/hooks/useTaskTable";
import { cn } from "@/lib/cn";

export interface TaskCardListProps {
  readonly rows: readonly TaskRowViewModel[];
  readonly now: string;
  readonly canEdit: boolean;
  readonly onOpen: (taskId: string) => void;
  readonly onToggleComplete: (taskId: string) => void;
}

/**
 * The list view below `md`.
 *
 * A five-column table does not fit a phone, so each task becomes a stacked
 * card. Both forms are driven by the same `useTaskTable` hook and open the same
 * drawer, and the inactive one is hidden with `display: none` — which keeps it
 * out of the accessibility tree and the tab order, so no JavaScript breakpoint
 * check is needed (Requirement 20.6).
 */
export function TaskCardList({
  rows,
  now,
  canEdit,
  onOpen,
  onToggleComplete,
}: TaskCardListProps) {
  function renderRow(row: TaskRowViewModel, depth: number) {
    return (
      <div key={row.task.id} className={cn(depth > 0 && "ml-4")}>
        <Card
          interactive
          padding="md"
          role="button"
          tabIndex={0}
          aria-label={row.task.title}
          onClick={(event) => {
            const interactive = (event.target as HTMLElement).closest(
              "button, input, label",
            );

            if (interactive) return;

            onOpen(row.task.id);
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;

            if (event.key === "Enter") {
              event.preventDefault();
              onOpen(row.task.id);
            }
          }}
          className="cursor-pointer"
        >
          <div className="flex items-start gap-2">
            <span className="-mt-0.5 shrink-0">
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

            <span
              className={cn(
                "min-w-0 flex-1 text-sm text-ink-900",
                row.task.isComplete && "text-ink-400 line-through",
              )}
            >
              {row.task.title}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill
              name={row.statusName}
              colorToken={row.statusToken}
              variant="dot-label"
            />
            <PriorityBadge priority={row.task.priority} showLabel />
            <DueDateChip date={row.task.dueDate} now={now} />
            <span className="ml-auto">
              <AvatarGroup users={row.task.assignees} max={3} size="xs" />
            </span>
          </div>
        </Card>

        {row.subtasks.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {row.subtasks.map((subtask) => renderRow(subtask, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => renderRow(row, 0))}
    </div>
  );
}

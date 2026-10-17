import { AssigneePicker } from "@/components/ui/AssigneePicker";
import type { AvatarGroupMember } from "@/components/ui/AvatarGroup";
import { Card } from "@/components/ui/Card";
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

export interface TaskCardListProps {
  readonly rows: readonly TaskRowViewModel[];
  readonly now: string;
  readonly canEdit: boolean;
  /** Why editing is refused, for the inline pickers (Requirement 8.11). */
  readonly readOnlyReason?: string | undefined;
  /** Whether a mutation on a given task is in flight (Requirement 14.7). */
  readonly isPending: (taskId: string) => boolean;
  readonly statuses: readonly StatusPickerOption[];
  readonly members: readonly AvatarGroupMember[];
  readonly onOpen: (taskId: string) => void;
  readonly onToggleComplete: (taskId: string) => void;
  readonly onRename: (taskId: string, title: string) => void;
  readonly onSetStatus: (taskId: string, statusId: string) => void;
  readonly onSetPriority: (taskId: string, priority: Priority) => void;
  readonly onSetDueDate: (taskId: string, dueDate: string | null) => void;
  readonly onToggleAssignee: (taskId: string, userId: string) => void;
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
  readOnlyReason,
  isPending,
  statuses,
  members,
  onOpen,
  onToggleComplete,
  onRename,
  onSetStatus,
  onSetPriority,
  onSetDueDate,
  onToggleAssignee,
}: TaskCardListProps) {
  function renderRow(row: TaskRowViewModel, depth: number) {
    return (
      <div key={row.task.id} className={cn(depth > 0 && "ml-4")}>
        <Card
          interactive
          pending={isPending(row.task.id)}
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
                  "text-sm text-ink-900",
                  row.task.isComplete && "text-ink-400 line-through",
                )}
                onCommit={(next) => {
                  if (next.trim().length > 0) onRename(row.task.id, next.trim());
                }}
              />
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/*
              The same inline pickers the table uses, so the phone layout is
              not a read-only version of the same view (Requirement 20.6).
            */}
            <StatusPicker
              value={row.statusId}
              options={statuses}
              variant="dot-label"
              disabled={!canEdit}
              disabledReason={readOnlyReason}
              onChange={(statusId) => {
                onSetStatus(row.task.id, statusId);
              }}
            />
            <PriorityPicker
              value={row.task.priority}
              showLabel
              disabled={!canEdit}
              disabledReason={readOnlyReason}
              onChange={(priority) => {
                onSetPriority(row.task.id, priority);
              }}
            />
            <DueDatePicker
              value={row.task.dueDate}
              now={now}
              disabled={!canEdit}
              disabledReason={readOnlyReason}
              onChange={(dueDate) => {
                onSetDueDate(row.task.id, dueDate);
              }}
            />
            <span className="ml-auto">
              <AssigneePicker
                assignees={row.task.assignees}
                members={members}
                disabled={!canEdit}
                disabledReason={readOnlyReason}
                onToggle={(userId) => {
                  onToggleAssignee(row.task.id, userId);
                }}
              />
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

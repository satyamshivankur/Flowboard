import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Inbox, Plus } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import type { StatusColorToken } from "@/config/statusCategories";
import type { TaskCardViewModel } from "@/controllers/hooks/useBoard";
import { cn } from "@/lib/cn";

import { TaskCard, type TaskCardStatusOption } from "./TaskCard";

export interface KanbanColumnProps {
  readonly statusId: string;
  readonly name: string;
  readonly colorToken: StatusColorToken;
  readonly count: number;
  readonly tasks: readonly TaskCardViewModel[];
  readonly now: string;
  readonly canEdit: boolean;
  readonly statuses: readonly TaskCardStatusOption[];
  readonly moveTargets: readonly { id: string; name: string }[];
  readonly members: readonly { id: string; name: string }[];
  readonly onOpen: (taskId: string) => void;
  readonly onToggleComplete: (taskId: string) => void;
  readonly onSetPriority: (taskId: string, priority: string) => void;
  readonly onSetStatus: (taskId: string, statusId: string) => void;
  readonly onToggleAssignee: (taskId: string, userId: string) => void;
  readonly onSetDueDate: (taskId: string, dueDate: string | null) => void;
  readonly onReorder: (taskId: string, toIndex: number) => void;
  readonly onDuplicate: (taskId: string) => void;
  readonly onMoveToList: (taskId: string, listId: string) => void;
  readonly onDelete: (taskId: string) => void;
  readonly onCreate: (statusId: string, title: string) => void;
}

export function KanbanColumn({
  statusId,
  name,
  colorToken,
  count,
  tasks,
  now,
  canEdit,
  statuses,
  moveTargets,
  members,
  onOpen,
  onToggleComplete,
  onSetPriority,
  onSetStatus,
  onToggleAssignee,
  onSetDueDate,
  onReorder,
  onDuplicate,
  onMoveToList,
  onDelete,
  onCreate,
}: KanbanColumnProps) {
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");

  /*
   * The column is a droppable in its own right, not just a container of
   * sortable cards. Without it, an empty column could never be a drop target —
   * there would be nothing to collide with (Requirement 4.9).
   */
  const { setNodeRef, isOver } = useDroppable({
    id: statusId,
    data: { type: "column", statusId },
  });

  function submit() {
    const trimmed = title.trim();

    if (trimmed.length > 0) onCreate(statusId, trimmed);

    setTitle("");
    setComposing(false);
  }

  return (
    <section
      aria-label={name}
      className={cn(
        "flex shrink-0 snap-center flex-col gap-2",
        // One column at a time on a phone, side by side from `md`. Same
        // elements either way — no JavaScript breakpoint (Requirement 20.5).
        "w-column-mobile md:w-column",
      )}
    >
      <header className="flex h-8 shrink-0 items-center justify-between gap-2 px-1">
        <StatusPill name={name} colorToken={colorToken} variant="dot-label" />

        <span className="flex items-center gap-1">
          <span className="text-xs font-medium tabular-nums text-ink-400">
            {count}
          </span>
          <IconButton
            icon={Plus}
            label={`Add task to ${name}`}
            size="xs"
            disabled={!canEdit}
            onClick={() => {
              setComposing(true);
            }}
          />
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-0.5",
          "transition-colors motion-reduce:transition-none",
          // Highlighting the column, not just the insertion point, is what
          // makes a drop target legible mid-drag (Requirement 4.6).
          isOver && "bg-brand-50/60 ring-1 ring-inset ring-brand-600/30",
        )}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              now={now}
              canEdit={canEdit}
              statuses={statuses}
              moveTargets={moveTargets}
              members={members}
              index={index}
              columnLength={tasks.length}
              onOpen={onOpen}
              onToggleComplete={onToggleComplete}
              onSetPriority={onSetPriority}
              onSetStatus={onSetStatus}
              onToggleAssignee={onToggleAssignee}
              onSetDueDate={onSetDueDate}
              onReorder={onReorder}
              onDuplicate={onDuplicate}
              onMoveToList={onMoveToList}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {composing && (
          <Input
            label={`New task in ${name}`}
            labelHidden
            autoFocus
            value={title}
            placeholder="Task title"
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            onBlur={submit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setTitle("");
                setComposing(false);
              }
            }}
          />
        )}

        {tasks.length === 0 && !composing && (
          <EmptyState
            icon={Inbox}
            title="No tasks"
            size="sm"
            isDropTarget
            isDragOver={isOver}
          />
        )}
      </div>
    </section>
  );
}

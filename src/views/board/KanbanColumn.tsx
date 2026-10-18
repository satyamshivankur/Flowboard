import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { Inbox, Plus } from "lucide-react";
import { memo, useCallback, useState } from "react";

import type { AvatarGroupMember } from "@/components/ui/AvatarGroup";
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
  /** Why editing is refused, forwarded to each card's menu (Req 8.11, 17.2). */
  readonly readOnlyReason: string | undefined;
  readonly statuses: readonly TaskCardStatusOption[];
  readonly moveTargets: readonly { id: string; name: string }[];
  readonly members: readonly AvatarGroupMember[];
  /**
   * True when the drag currently points at this column.
   *
   * Resolved by the board rather than read from this column's own
   * `useDroppable().isDropTarget`. In a non-empty column the cards win the
   * collision, so that flag stays false and only empty columns ever
   * highlighted — the reported bug (Requirement 4.6).
   */
  readonly isDragOver: boolean;
  /** Whether a mutation on a given task is in flight (Requirement 14.7). */
  readonly isPending: (taskId: string) => boolean;
  /**
   * Which cards have their subtasks revealed, and the toggle.
   *
   * Held by the board rather than by each card, which is what lets an
   * expansion survive a drag across columns — the card remounts, the set does
   * not. Same arrangement the list view uses for its table rows.
   */
  readonly expandedIds: ReadonlySet<string>;
  readonly onToggleExpand: (taskId: string) => void;
  readonly onOpen: (taskId: string) => void;
  readonly onToggleComplete: (taskId: string) => void;
  readonly onRename: (taskId: string, title: string) => void;
  readonly onSetPriority: (taskId: string, priority: string) => void;
  readonly onSetStatus: (taskId: string, statusId: string) => void;
  readonly onToggleAssignee: (taskId: string, userId: string) => void;
  readonly onSetDueDate: (taskId: string, dueDate: string | null) => void;
  /**
   * Reorder within *this* column.
   *
   * Takes the status id so the board can expose one stable callback for every
   * column rather than a fresh closure per column per render — which is what
   * `memo` on `TaskCard` needs in order to do anything.
   */
  readonly onReorderInColumn: (
    taskId: string,
    statusId: string,
    toIndex: number,
  ) => void;
  readonly onDuplicate: (taskId: string) => void;
  readonly onMoveToList: (taskId: string, listId: string) => void;
  readonly onDelete: (taskId: string) => void;
  readonly onCreate: (statusId: string, title: string) => void;
}

/**
 * Memoised alongside `TaskCard`.
 *
 * Every callback the board passes down is stable and the board's column data
 * does not change during a drag, so the one prop a crossing alters is
 * `isDragOver` — which means a crossing re-renders the two columns whose
 * highlight changed and leaves the rest of the board alone.
 */
export const KanbanColumn = memo(KanbanColumnImpl);

function KanbanColumnImpl({
  statusId,
  name,
  colorToken,
  count,
  tasks,
  now,
  canEdit,
  readOnlyReason,
  statuses,
  moveTargets,
  members,
  isDragOver,
  isPending,
  expandedIds,
  onToggleExpand,
  onOpen,
  onToggleComplete,
  onRename,
  onSetPriority,
  onSetStatus,
  onToggleAssignee,
  onSetDueDate,
  onReorderInColumn,
  onDuplicate,
  onMoveToList,
  onDelete,
  onCreate,
}: KanbanColumnProps) {
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");

  /* Bound to this column, and stable, so the cards below can be memoised. */
  const handleReorder = useCallback(
    (taskId: string, toIndex: number) => {
      onReorderInColumn(taskId, statusId, toIndex);
    },
    [onReorderInColumn, statusId],
  );

  /*
   * The column is a droppable in its own right, not just a container of
   * sortable cards: it is what the pointer collides with in a column's empty
   * space, and the only target an empty column has at all
   * (Requirement 4.9).
   *
   * `CollisionPriority.Low` is what keeps it from stealing the collision from
   * its own cards. A column's rectangle contains every card in it, so at equal
   * priority the column would often win and the insertion point would snap to
   * the end of the list instead of following the pointer. Low priority means
   * the cards answer whenever the pointer is over one, and the column answers
   * only for the space between and below them.
   *
   * The *highlight* still comes from `isDragOver` rather than from
   * `isDropTarget` here, for exactly that reason: whenever a card wins, this
   * column is not the target even though the drag is plainly inside it
   * (Requirement 4.6).
   */
  const { ref } = useDroppable({
    id: statusId,
    type: "column",
    accept: "task",
    collisionPriority: CollisionPriority.Low,
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
        ref={ref}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-0.5",
          "transition-colors motion-reduce:transition-none",
          // Highlighting the column, not just the insertion point, is what
          // makes a drop target legible mid-drag (Requirement 4.6).
          isDragOver && "bg-brand-50/60 ring-1 ring-inset ring-brand-600/30",
        )}
      >
        {/*
          No `SortableContext` wrapper: the cards declare their group and index
          directly, which is what lets dnd-kit displace them across two
          columns without either column re-rendering.
        */}
        {tasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            columnId={statusId}
            now={now}
            canEdit={canEdit}
            readOnlyReason={readOnlyReason}
            statuses={statuses}
            moveTargets={moveTargets}
            members={members}
            index={index}
            columnLength={tasks.length}
            isPending={isPending}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            onOpen={onOpen}
            onToggleComplete={onToggleComplete}
            onRename={onRename}
            onSetPriority={onSetPriority}
            onSetStatus={onSetStatus}
            onToggleAssignee={onToggleAssignee}
            onSetDueDate={onSetDueDate}
            onReorder={handleReorder}
            onDuplicate={onDuplicate}
            onMoveToList={onMoveToList}
            onDelete={onDelete}
          />
        ))}

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
            isDragOver={isDragOver}
          />
        )}
      </div>
    </section>
  );
}

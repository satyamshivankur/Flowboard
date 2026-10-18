import { FileText, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { AssigneePicker } from "@/components/ui/AssigneePicker";
import type { AvatarGroupMember } from "@/components/ui/AvatarGroup";
import { Checkbox } from "@/components/ui/Checkbox";
import { DueDatePicker } from "@/components/ui/DueDatePicker";
import { IconButton } from "@/components/ui/IconButton";
import { InlineTextField } from "@/components/ui/InlineTextField";
import { Input } from "@/components/ui/Input";
import { PriorityPicker } from "@/components/ui/PriorityPicker";
import {
  StatusPicker,
  type StatusPickerOption,
} from "@/components/ui/StatusPicker";
import { MAX_TITLE_LEN } from "@/config/limits";
import type { Priority } from "@/config/priorities";
import type { DrawerSubtask } from "@/controllers/hooks/useTaskDrawer";
import { cn } from "@/lib/cn";

export interface SubtaskListProps {
  readonly subtasks: readonly DrawerSubtask[];
  /** Reference time, so the overdue tone is deterministic across rows. */
  readonly now: string;
  readonly canEdit: boolean;
  /** Why editing is refused, for the inline pickers (Requirement 8.11). */
  readonly readOnlyReason?: string | undefined;
  /**
   * The parent's list status set. Correct for a subtask without qualification,
   * because a subtask cannot leave its parent's list (Requirement 2.7).
   */
  readonly statuses: readonly StatusPickerOption[];
  readonly members: readonly AvatarGroupMember[];
  /** Whether a mutation on a given subtask is in flight (Requirement 14.7). */
  readonly isPending: (subtaskId: string) => boolean;
  readonly onToggle: (subtaskId: string) => void;
  readonly onCreate: (title: string) => void;
  readonly onOpen: (subtaskId: string) => void;
  readonly onDelete: (subtaskId: string) => void;
  readonly onRename: (subtaskId: string, title: string) => void;
  readonly onSetStatus: (subtaskId: string, statusId: string) => void;
  readonly onSetPriority: (subtaskId: string, priority: Priority) => void;
  readonly onSetDueDate: (subtaskId: string, dueDate: string | null) => void;
  readonly onToggleAssignee: (subtaskId: string, userId: string) => void;
}

/**
 * The depth-1 subtask list, editable in place.
 *
 * Deliberately flat: a subtask cannot have subtasks, which the Controller
 * enforces, so this needs no recursion (Requirement 2.11).
 *
 * Each row carries the same inline controls as the list view's nested rows and
 * the board's subtask cards — status, priority, due date, assignees, rename,
 * complete, delete — built from the same primitives in `components/ui`
 * (Requirement 7.4.1, 5.7, 4.13).
 *
 * It used to offer only complete, open and delete, on the reasoning that a
 * second full field set nested inside a drawer would be a drawer inside a
 * drawer. The flaw in that was the comparison: these are inline chips in a
 * row, the same ones a table cell holds, not a nested panel — and the cost was
 * that the drawer was the one subtask surface that could not change a
 * subtask's priority, while the two surfaces a user reaches it from both
 * could.
 *
 * Two controls are laid out rather than one, because the drawer is `32.5rem`
 * at its widest and a bottom sheet below `md`. That is phone-width, so this
 * follows `TaskCardList`'s stacked idiom — a title line and a wrapping chip
 * line — rather than the table's five columns.
 *
 * Requirement 2.13's three refusals need no handling here: move-to-list,
 * reorder and duplicate were never offered by this list, exactly as they are
 * never offered by a table row.
 */
export function SubtaskList({
  subtasks,
  now,
  canEdit,
  readOnlyReason,
  statuses,
  members,
  isPending,
  onToggle,
  onCreate,
  onOpen,
  onDelete,
  onRename,
  onSetStatus,
  onSetPriority,
  onSetDueDate,
  onToggleAssignee,
}: SubtaskListProps) {
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");

  const completed = subtasks.filter((subtask) => subtask.isComplete).length;

  function submit() {
    const trimmed = title.trim();

    if (trimmed.length > 0) onCreate(trimmed);

    setTitle("");
    setComposing(false);
  }

  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-900">
          Subtasks
          {subtasks.length > 0 && (
            <span className="ml-1.5 text-xs font-normal tabular-nums text-ink-400">
              {completed}/{subtasks.length}
            </span>
          )}
        </h3>

        <IconButton
          icon={Plus}
          label="Add subtask"
          size="xs"
          disabled={!canEdit}
          onClick={() => {
            setComposing(true);
          }}
        />
      </header>

      {subtasks.length === 0 && !composing && (
        <p className="text-xs text-ink-400">No subtasks yet.</p>
      )}

      <ul className="flex flex-col gap-1">
        {subtasks.map((subtask) => (
          <li
            key={subtask.id}
            aria-busy={isPending(subtask.id) || undefined}
            className={cn(
              "group flex flex-col gap-1 rounded-md px-1.5 py-1.5",
              "can-hover:hover:bg-surface-hover",
              "transition-opacity duration-150 motion-reduce:transition-none",
              // Subdued at the point of interaction, never a blocking overlay
              // (Requirement 14.7).
              isPending(subtask.id) && "opacity-60",
            )}
          >
            <div className="flex items-center gap-2">
              <Checkbox
                checked={subtask.isComplete}
                label={`Mark "${subtask.title}" complete`}
                labelHidden
                disabled={!canEdit}
                onChange={() => {
                  onToggle(subtask.id);
                }}
              />

              {/*
                Click-to-edit, as on a table row and a board card. This was a
                plain button that opened the subtask's own drawer, which is why
                opening now has an explicit control of its own below — the
                title's click is spent on editing.
              */}
              <span className="min-w-0 flex-1">
                <InlineTextField
                  key={`title-${subtask.id}`}
                  label="Title"
                  value={subtask.title}
                  placeholder="Untitled subtask"
                  disabled={!canEdit}
                  singleLine
                  maxLength={MAX_TITLE_LEN}
                  textClassName={cn(
                    "truncate text-sm",
                    subtask.isComplete
                      ? "text-ink-400 line-through"
                      : "text-ink-900",
                  )}
                  onCommit={(next) => {
                    if (next.trim().length > 0)
                      onRename(subtask.id, next.trim());
                  }}
                />
              </span>

              {/*
                Revealed on hover or focus-within where a pointer can hover,
                and persistently visible otherwise — an `opacity-0` button is
                still focusable, so tabbing into the row brings both back
                (Requirement 15.1, 20.10).
              */}
              <span
                className={cn(
                  "flex shrink-0 items-center",
                  "can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100",
                )}
              >
                {/*
                  The subtask's own drawer, which is where its description and
                  metadata live. This is what satisfies Requirement 15.10.1 —
                  a subtask is openable as a task in its own right, rather than
                  having its every field duplicated into its parent's panel.
                */}
                <IconButton
                  icon={FileText}
                  label={`Open "${subtask.title}"`}
                  size="xs"
                  tooltip={false}
                  onClick={() => {
                    onOpen(subtask.id);
                  }}
                />

                <IconButton
                  icon={Trash2}
                  label={`Delete "${subtask.title}"`}
                  size="xs"
                  variant="danger"
                  tooltip={false}
                  disabled={!canEdit}
                  onClick={() => {
                    onDelete(subtask.id);
                  }}
                />
              </span>
            </div>

            {/*
              Indented to clear the checkbox, so the chips read as belonging to
              the title above them rather than as a second row of their own.
            */}
            <div className="flex flex-wrap items-center gap-1.5 pl-6">
              <StatusPicker
                value={subtask.statusId}
                options={statuses}
                variant="dot-label"
                disabled={!canEdit}
                disabledReason={readOnlyReason}
                onChange={(statusId) => {
                  onSetStatus(subtask.id, statusId);
                }}
              />

              <PriorityPicker
                value={subtask.priority}
                showLabel
                disabled={!canEdit}
                disabledReason={readOnlyReason}
                onChange={(priority) => {
                  onSetPriority(subtask.id, priority);
                }}
              />

              <DueDatePicker
                value={subtask.dueDate}
                now={now}
                disabled={!canEdit}
                disabledReason={readOnlyReason}
                onChange={(dueDate) => {
                  onSetDueDate(subtask.id, dueDate);
                }}
              />

              <span className="ml-auto">
                <AssigneePicker
                  assignees={subtask.assignees}
                  members={members}
                  max={3}
                  disabled={!canEdit}
                  disabledReason={readOnlyReason}
                  onToggle={(userId) => {
                    onToggleAssignee(subtask.id, userId);
                  }}
                />
              </span>
            </div>
          </li>
        ))}
      </ul>

      {composing && (
        <Input
          label="New subtask"
          labelHidden
          autoFocus
          inputSize="sm"
          value={title}
          placeholder="Subtask title"
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
    </section>
  );
}

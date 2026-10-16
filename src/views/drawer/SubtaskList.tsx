import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/Checkbox";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import type { DrawerSubtask } from "@/controllers/hooks/useTaskDrawer";
import { cn } from "@/lib/cn";

export interface SubtaskListProps {
  readonly subtasks: readonly DrawerSubtask[];
  readonly canEdit: boolean;
  /** Whether a mutation on a given subtask is in flight (Requirement 14.7). */
  readonly isPending: (subtaskId: string) => boolean;
  readonly onToggle: (subtaskId: string) => void;
  readonly onCreate: (title: string) => void;
  readonly onOpen: (subtaskId: string) => void;
  readonly onDelete: (subtaskId: string) => void;
}

/**
 * The depth-1 subtask list.
 *
 * Deliberately flat: a subtask cannot have subtasks, which the Controller
 * enforces, so this needs no recursion (Requirement 2.11).
 */
export function SubtaskList({
  subtasks,
  canEdit,
  isPending,
  onToggle,
  onCreate,
  onOpen,
  onDelete,
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

      <ul className="flex flex-col gap-0.5">
        {subtasks.map((subtask) => (
          <li
            key={subtask.id}
            aria-busy={isPending(subtask.id) || undefined}
            className={cn(
              "group flex items-center gap-2 rounded-md px-1",
              "h-11 can-hover:h-8",
              "can-hover:hover:bg-surface-hover",
              "transition-opacity duration-150 motion-reduce:transition-none",
              // Subdued at the point of interaction, never a blocking overlay
              // (Requirement 14.7).
              isPending(subtask.id) && "opacity-60",
            )}
          >
            <Checkbox
              checked={subtask.isComplete}
              label={`Mark "${subtask.title}" complete`}
              labelHidden
              disabled={!canEdit}
              onChange={() => {
                onToggle(subtask.id);
              }}
            />

            <button
              type="button"
              onClick={() => {
                onOpen(subtask.id);
              }}
              className={cn(
                // `self-stretch`: the row is `h-11` on touch, so the button
                // has to claim that height rather than just its text's.
                "min-w-0 flex-1 self-stretch truncate rounded text-left text-sm",
                "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-1",
                subtask.isComplete
                  ? "text-ink-400 line-through"
                  : "text-ink-900",
              )}
            >
              {subtask.title}
            </button>

            <span
              className={cn(
                "shrink-0",
                "can-hover:opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100",
              )}
            >
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

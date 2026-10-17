import { useState } from "react";

import { cn } from "@/lib/cn";

import { Input } from "./Input";
import { Textarea } from "./Textarea";

export interface InlineTextFieldProps {
  readonly value: string;
  readonly placeholder: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly maxLength?: number | undefined;
  readonly textClassName?: string | undefined;
  readonly error?: string | undefined;
  /**
   * Commits on plain Enter and refuses newlines.
   *
   * A title is not prose. Rendering it in a `Textarea` meant Enter inserted a
   * line break into a field that is displayed on one line everywhere else, and
   * committing needed ⌘/Ctrl+Enter — a shortcut nobody discovers on a kanban
   * card (Requirement 7.5).
   */
  readonly singleLine?: boolean | undefined;
  /** Shown instead of the value when empty and not being edited. */
  readonly onCommit: (value: string) => void;
}

/**
 * Click-to-edit text, used for the drawer's title and description.
 *
 * Saves on blur and on Cmd/Ctrl+Enter; Escape reverts the field rather than
 * closing the drawer around it. Losing a long description to a stray Escape is
 * the obvious failure mode, which is why `Textarea` stops that key from
 * propagating (Requirement 7.5).
 *
 * The draft is local state, reset by remounting on `value` change via a `key`
 * at the call site — not synced through an effect, which would fight the user's
 * keystrokes.
 */
export function InlineTextField({
  value,
  placeholder,
  label,
  disabled,
  maxLength,
  textClassName,
  error,
  singleLine = false,
  onCommit,
}: InlineTextFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  /*
   * Read-only renders as plain text rather than a disabled button. A disabled
   * button still absorbs the click, and on a card or a row the click it would
   * absorb is the one that opens the drawer (Requirement 7.10, 15.4).
   */
  if (!editing && disabled) {
    return (
      <span
        className={cn(
          "block w-full px-2 py-1",
          value.length === 0 && "text-ink-400",
          textClassName,
        )}
      >
        <span className="whitespace-pre-wrap break-words">
          {value.length === 0 ? placeholder : value}
        </span>
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          "w-full rounded-md px-2 py-1 text-left",
          // A one-line title is about 2rem tall, which is under the touch
          // minimum for what is the drawer's primary edit affordance.
          "coarse-pointer:min-h-touch",
          "transition-colors motion-reduce:transition-none",
          "can-hover:hover:bg-surface-hover",
          "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2",
          // Scoped under `can-hover` so it cancels the hover background set
          // just above rather than standing as a bare `hover:` of its own —
          // which is what the no-hover-dependence audit greps for.
          "disabled:cursor-default can-hover:disabled:hover:bg-transparent",
          value.length === 0 && "text-ink-400",
          textClassName,
        )}
        aria-label={`Edit ${label.toLowerCase()}`}
      >
        {/* `whitespace-pre-wrap` so a markdown description keeps its line
            breaks without a renderer — the source is stored as typed. */}
        <span className="whitespace-pre-wrap wrap-break-word">
          {value.length === 0 ? placeholder : value}
        </span>
      </button>
    );
  }

  function commit(next: string) {
    setEditing(false);

    if (next !== value) onCommit(next);
  }

  if (singleLine) {
    return (
      <Input
        label={label}
        labelHidden
        autoFocus
        inputSize="sm"
        value={draft}
        maxLength={maxLength}
        error={error}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          commit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
          }

          if (event.key === "Escape") {
            /*
             * Stopped here as well as in `Textarea`: without it, Escape
             * reverts the field *and* closes the drawer or dialog around it,
             * so a stray keystroke loses the edit and the context together.
             */
            event.stopPropagation();
            event.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <Textarea
      label={label}
      labelHidden
      autoFocus
      value={draft}
      maxLength={maxLength}
      showCount={maxLength !== undefined}
      error={error}
      placeholder={placeholder}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={() => {
        setEditing(false);

        if (draft !== value) onCommit(draft);
      }}
      onCommit={() => {
        setEditing(false);

        if (draft !== value) onCommit(draft);
      }}
      onCancel={() => {
        setDraft(value);
        setEditing(false);
      }}
    />
  );
}

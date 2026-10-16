import { useState } from "react";

import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";

export interface InlineTextFieldProps {
  readonly value: string;
  readonly placeholder: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly maxLength?: number | undefined;
  readonly textClassName?: string | undefined;
  readonly error?: string | undefined;
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
  onCommit,
}: InlineTextFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

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
          "transition-colors motion-reduce:transition-none",
          "can-hover:hover:bg-surface-hover",
          "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2",
          "disabled:cursor-default disabled:hover:bg-transparent",
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

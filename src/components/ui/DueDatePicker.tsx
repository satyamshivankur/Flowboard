import { CalendarPlus } from "lucide-react";

import {
  inlinePickerTriggerClass,
  type InlinePickerSize,
} from "@/lib/inlineTrigger";

import { DatePicker } from "./DatePicker";
import { DueDateChip } from "./DueDateChip";
import { InlineEmpty, InlineReadOnly } from "./InlinePicker";

export interface DueDatePickerProps {
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  /** Reference time, so the overdue tone is deterministic. */
  readonly now: string;
  readonly disabled?: boolean | undefined;
  readonly disabledReason?: string | undefined;
  readonly size?: InlinePickerSize | undefined;
  readonly emptyLabel?: string | undefined;
}

/**
 * The due date, editable where it is displayed.
 *
 * The chip is the trigger, which is the reason `DatePicker` takes one: the
 * overdue and due-today tones live in `DueDateChip` and a generic button
 * cannot express them, so the inline form has to reuse the chip rather than
 * re-describe it (Requirement 15.8, 13.6).
 *
 * `DueDateChip` renders `null` with no date — right for a read-only row,
 * useless for an editable one — so an explicit placeholder stands in.
 */
export function DueDatePicker({
  value,
  onChange,
  now,
  disabled = false,
  size = "sm",
  emptyLabel = "Set date",
}: DueDatePickerProps) {
  const chip =
    value === null ? (
      <InlineEmpty
        label={emptyLabel}
        icon={
          <CalendarPlus
            className="size-icon-sm"
            strokeWidth={1.75}
            aria-hidden
          />
        }
      />
    ) : (
      <DueDateChip date={value} now={now} />
    );

  if (disabled) {
    if (value === null) return null;

    return <InlineReadOnly>{chip}</InlineReadOnly>;
  }

  return (
    <DatePicker
      label="Due date"
      value={value}
      now={now}
      onChange={onChange}
      hideClear
      trigger={
        <button
          type="button"
          aria-label="Due date"
          className={inlinePickerTriggerClass(size)}
        >
          {chip}
        </button>
      }
    />
  );
}

import type { StatusColorToken } from "@/config/statusCategories";
import {
  inlinePickerTriggerClass,
  type InlinePickerSize,
} from "@/lib/inlineTrigger";

import { InlineReadOnly } from "./InlinePicker";
import { Menu } from "./Menu";
import { StatusPill, type StatusPillVariant } from "./StatusPill";

export interface StatusPickerOption {
  readonly id: string;
  readonly name: string;
  readonly colorToken: StatusColorToken;
}

export interface StatusPickerProps {
  readonly value: string;
  readonly options: readonly StatusPickerOption[];
  readonly onChange: (statusId: string) => void;
  readonly disabled?: boolean | undefined;
  readonly disabledReason?: string | undefined;
  readonly variant?: StatusPillVariant | undefined;
  readonly align?: "start" | "end" | undefined;
  readonly size?: InlinePickerSize | undefined;
}

/**
 * Status, editable where it is displayed.
 *
 * The pill is the trigger: clicking it in a list row opens the list's status
 * set. Deliberately no chevron — a caret on every row would make the table
 * read as a form rather than as data, so the affordance is the hover and focus
 * highlight `InlinePickerTrigger` supplies.
 *
 * Not offered on a kanban card, where the column *is* the status and a second
 * control for it would be two sources of truth for one value.
 */
export function StatusPicker({
  value,
  options,
  onChange,
  disabled = false,
  disabledReason,
  variant = "pill",
  align = "start",
  size = "sm",
}: StatusPickerProps) {
  const current = options.find((option) => option.id === value);

  const pill = (
    <StatusPill
      name={current?.name ?? "Unknown"}
      colorToken={current?.colorToken ?? "status-todo"}
      variant={variant}
    />
  );

  if (disabled) return <InlineReadOnly>{pill}</InlineReadOnly>;

  return (
    <Menu
      align={align}
      label={`Status: ${current?.name ?? "Unknown"}`}
      items={options.map((option) => ({
        id: option.id,
        label: option.name,
        content: (
          <StatusPill
            name={option.name}
            colorToken={option.colorToken}
            variant="dot-label"
          />
        ),
        selected: option.id === value,
        disabledReason,
        onSelect: () => {
          onChange(option.id);
        },
      }))}
      trigger={
        <button type="button" className={inlinePickerTriggerClass(size)}>
          {pill}
        </button>
      }
    />
  );
}

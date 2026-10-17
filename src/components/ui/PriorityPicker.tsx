import { PRIORITIES, PRIORITY_CONFIG, type Priority } from "@/config/priorities";
import {
  inlinePickerTriggerClass,
  type InlinePickerSize,
} from "@/lib/inlineTrigger";

import { InlineReadOnly } from "./InlinePicker";
import { Menu } from "./Menu";
import { PriorityBadge } from "./PriorityBadge";

export interface PriorityPickerProps {
  readonly value: Priority;
  readonly onChange: (priority: Priority) => void;
  readonly disabled?: boolean | undefined;
  readonly disabledReason?: string | undefined;
  /** Shows the priority name beside the icon, for the roomier surfaces. */
  readonly showLabel?: boolean | undefined;
  readonly align?: "start" | "end" | undefined;
  readonly size?: InlinePickerSize | undefined;
  /** Names the control, since the badge alone says what but not which field. */
  readonly label?: string | undefined;
}

/**
 * Priority, editable where it is displayed.
 *
 * The badge is the trigger — click it on a card or a row and pick. Both the
 * trigger and the options render through `PriorityBadge`, so the thing being
 * chosen looks identical to the thing already chosen, and all of it comes from
 * `PRIORITY_CONFIG` (Requirement 13.6).
 */
export function PriorityPicker({
  value,
  onChange,
  disabled = false,
  disabledReason,
  showLabel = false,
  align = "start",
  size = "sm",
  label = "Priority",
}: PriorityPickerProps) {
  const badge = <PriorityBadge priority={value} showLabel={showLabel} />;

  if (disabled) return <InlineReadOnly>{badge}</InlineReadOnly>;

  return (
    <Menu
      align={align}
      label={`${label}: ${PRIORITY_CONFIG[value].label}`}
      items={PRIORITIES.map((priority) => ({
        id: priority,
        label: PRIORITY_CONFIG[priority].label,
        content: <PriorityBadge priority={priority} showLabel />,
        selected: priority === value,
        disabledReason,
        onSelect: () => {
          onChange(priority);
        },
      }))}
      trigger={
        <button type="button" className={inlinePickerTriggerClass(size)}>
          {badge}
        </button>
      }
    />
  );
}

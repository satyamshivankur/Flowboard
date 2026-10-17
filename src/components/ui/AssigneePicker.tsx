import { UserPlus } from "lucide-react";

import {
  inlinePickerTriggerClass,
  type InlinePickerSize,
} from "@/lib/inlineTrigger";

import { Avatar, type AvatarSize } from "./Avatar";
import { AvatarGroup, type AvatarGroupMember } from "./AvatarGroup";
import { InlineEmpty, InlineReadOnly } from "./InlinePicker";
import { Menu } from "./Menu";

export interface AssigneePickerProps {
  readonly assignees: readonly AvatarGroupMember[];
  readonly members: readonly AvatarGroupMember[];
  readonly onToggle: (userId: string) => void;
  readonly disabled?: boolean | undefined;
  readonly disabledReason?: string | undefined;
  readonly max?: number | undefined;
  readonly avatarSize?: AvatarSize | undefined;
  readonly align?: "start" | "end" | undefined;
  readonly size?: InlinePickerSize | undefined;
  /** Shown in place of the stack when nobody is assigned. */
  readonly emptyLabel?: string | undefined;
}

/**
 * Assignees, editable where they are displayed.
 *
 * The avatar stack is the trigger. `AvatarGroup` renders `null` when empty,
 * which is correct for a read-only row and useless for an editable one — an
 * unassigned task would have had nothing to click — so an explicit "Assign"
 * placeholder stands in.
 *
 * One toggle per opening. Headless UI's `MenuItem` closes the menu on click
 * unconditionally — its handler does not consult `defaultPrevented`, so there
 * is no way to keep it open without abandoning `MenuItem` and the roving focus
 * it brings. Assigning three people is therefore three openings, which matches
 * how the drawer's own picker already behaves; a bulk editor is a different
 * control than an inline one.
 */
export function AssigneePicker({
  assignees,
  members,
  onToggle,
  disabled = false,
  disabledReason,
  max = 3,
  avatarSize = "xs",
  align = "end",
  size = "sm",
  emptyLabel = "Assign",
}: AssigneePickerProps) {
  const assignedIds = new Set(assignees.map((user) => user.id));

  const stack =
    assignees.length === 0 ? (
      <InlineEmpty
        label={emptyLabel}
        icon={
          <UserPlus className="size-icon-sm" strokeWidth={1.75} aria-hidden />
        }
      />
    ) : (
      <AvatarGroup users={assignees} max={max} size={avatarSize} />
    );

  // Nothing at all when read-only and unassigned: an "Assign" placeholder
  // that cannot assign is just noise.
  if (disabled) {
    if (assignees.length === 0) return null;

    return <InlineReadOnly>{stack}</InlineReadOnly>;
  }

  const names =
    assignees.length === 0
      ? "Unassigned"
      : assignees.map((user) => user.name).join(", ");

  return (
    <Menu
      align={align}
      label={`Assignees: ${names}`}
      items={members.map((member) => ({
        id: member.id,
        label: member.name,
        selected: assignedIds.has(member.id),
        disabledReason,
        content: (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar
              name={member.name}
              avatarToken={member.avatarToken}
              size="xs"
              showTooltip={false}
            />
            <span className="truncate">{member.name}</span>
          </span>
        ),
        onSelect: () => {
          onToggle(member.id);
        },
      }))}
      trigger={
        <button type="button" className={inlinePickerTriggerClass(size)}>
          {stack}
        </button>
      }
    />
  );
}

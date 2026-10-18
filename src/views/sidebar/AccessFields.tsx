import { Globe, Lock } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Checkbox } from "@/components/ui/Checkbox";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { Visibility } from "@/config/containers";
import type { AccessMemberViewModel } from "@/controllers/hooks/useContainerAccess";
import { cn } from "@/lib/cn";
import type { ContainerAccess } from "@/model/access";

export interface AccessFieldsProps {
  /** Lower-cased in the copy, so "list" reads as "who can see this list". */
  readonly typeLabel: string;
  readonly access: ContainerAccess;
  readonly members: readonly AccessMemberViewModel[];
  readonly disabled?: boolean;
  readonly onChange: (access: ContainerAccess) => void;
}

/**
 * Who can see a container.
 *
 * Presentational: access in, a new access out. The same control serves creation
 * and later editing, which is deliberate — an admin deciding access on a new
 * list and revisiting it a week later should be looking at the same thing
 * (Requirement 8.15, 8.16).
 *
 * One checkbox list, two meanings, resolved by the mode above it. Under
 * "Selected people" a tick writes an explicit allow; under "Everyone" the list
 * starts fully ticked and unticking writes an explicit deny. Expressing both as
 * "has access" keeps the control honest — the alternative, a three-state
 * allow/inherit/deny picker per member, exposes the storage model rather than
 * the question being asked.
 */
const MODE_OPTIONS = [
  { value: "public" as const, label: "Everyone", icon: Globe },
  { value: "private" as const, label: "Selected people", icon: Lock },
];

export function AccessFields({
  typeLabel,
  access,
  members,
  disabled = false,
  onChange,
}: AccessFieldsProps) {
  const noun = typeLabel.toLowerCase();
  const governed = members.filter((member) => !member.bypasses);
  const selected = new Set(access.memberIds);

  /*
   * Switching to "Everyone" ticks every governed member; switching back keeps
   * whatever is ticked.
   *
   * The asymmetry is the point. Under "Everyone" an unticked member is an
   * explicit deny, so carrying a sparse selection into that mode would turn
   * "not granted yet" into "actively blocked" without the user asking for it.
   * Going the other way, the ticks already mean what they will mean.
   */
  function handleVisibility(visibility: Visibility) {
    onChange({
      visibility,
      memberIds:
        visibility === "public"
          ? governed.map((member) => member.id)
          : access.memberIds,
    });
  }

  function handleToggle(userId: string) {
    onChange({
      visibility: access.visibility,
      memberIds: selected.has(userId)
        ? access.memberIds.filter((id) => id !== userId)
        : [...access.memberIds, userId],
    });
  }

  const withAccess = governed.filter((member) => selected.has(member.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink-900">
          Who can access this {noun}
        </span>

        <SegmentedControl
          options={MODE_OPTIONS}
          value={access.visibility}
          onChange={handleVisibility}
          ariaLabel={`Access for this ${noun}`}
          size="md"
          className={cn(disabled && "pointer-events-none opacity-50")}
        />
      </div>

      <ul className="flex flex-col gap-0.5">
        {members.map((member) => (
          <li key={member.id}>
            <div className="flex min-h-touch items-center gap-2 rounded-md px-1 can-hover:min-h-9">
              <Checkbox
                label={member.name}
                labelHidden
                checked={member.bypasses || selected.has(member.id)}
                disabled={disabled || member.bypasses}
                onChange={() => {
                  handleToggle(member.id);
                }}
              />

              <Avatar
                name={member.name}
                avatarToken={member.avatarToken}
                size="xs"
                showTooltip={false}
              />

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-ink-900">
                  {member.name}
                </span>

                {/*
                  The caption carries the reason a row is not what it looks
                  like. An admin's ticked, disabled checkbox is otherwise
                  unexplained, and a member ticked here but unable to reach the
                  parent would look granted while staying invisible.
                */}
                {member.bypasses && (
                  <span className="truncate text-xs text-ink-400">
                    {member.roleLabel} — always has access
                  </span>
                )}

                {!member.bypasses &&
                  member.blockedByAncestor &&
                  selected.has(member.id) && (
                    <span className="truncate text-xs text-warning-700">
                      No access to the parent, so this stays hidden
                    </span>
                  )}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-ink-600">
        {access.visibility === "public"
          ? summarizeOpen(governed.length - withAccess.length, noun)
          : summarizeRestricted(withAccess.length, noun)}
      </p>
    </div>
  );
}

/** Copy for "Everyone", where the interesting number is who is excluded. */
function summarizeOpen(excluded: number, noun: string): string {
  if (excluded === 0) {
    return `Every member of the workspace can see this ${noun}.`;
  }

  return `Everyone except ${String(excluded)} member${excluded === 1 ? "" : "s"} can see this ${noun}.`;
}

/** Copy for "Selected people", where an empty list is the notable case. */
function summarizeRestricted(included: number, noun: string): string {
  if (included === 0) {
    return `Only admins will be able to see this ${noun}.`;
  }

  return `${String(included)} member${included === 1 ? "" : "s"} plus all admins can see this ${noun}.`;
}

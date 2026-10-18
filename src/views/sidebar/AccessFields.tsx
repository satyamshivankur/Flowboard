import { Avatar } from "@/components/ui/Avatar";
import { Checkbox } from "@/components/ui/Checkbox";
import { Separator } from "@/components/ui/Separator";
import type { AccessMemberViewModel } from "@/controllers/hooks/useContainerAccess";
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
 * **One list, one meaning.** Every row is "has access", and "Everyone" is the
 * select-all at the top of that list rather than a mode above it. An earlier
 * version made it a two-option segmented control, which put the member list
 * into one of two states that looked identical and behaved differently: a
 * ticked member meant an explicit `allow` under one and nothing at all under
 * the other. A checkbox that ticks and clears the list has no such hidden
 * state — what the rows show is what will be saved (Requirement 8.16.3).
 *
 * `visibility` is therefore derived rather than chosen: everyone ticked is
 * `public`, anything less is `private` plus an explicit allow per tick. That
 * mapping is the honest one, because `public` is also what admits members
 * added to the workspace *later* — which is what "Everyone" says and a list of
 * three names does not.
 */
export function AccessFields({
  typeLabel,
  access,
  members,
  disabled = false,
  onChange,
}: AccessFieldsProps) {
  const noun = typeLabel.toLowerCase();

  /*
   * Bypassing roles are excluded from the arithmetic entirely. Their rows are
   * rendered ticked and disabled, but counting them would make "Everyone"
   * unreachable — the access list cannot grant what a bypass already gives.
   */
  const governed = members.filter((member) => !member.bypasses);
  const selected = new Set(access.memberIds);

  const selectedCount = governed.filter((member) =>
    selected.has(member.id),
  ).length;

  const hasGoverned = governed.length > 0;
  const allSelected = hasGoverned && selectedCount === governed.length;
  const someSelected = selectedCount > 0;

  /**
   * Emits a selection, deriving `visibility` from it.
   *
   * Note what this does *not* do: normalise on mount. A dialog opened on a
   * container stored as `public` with one deny row renders correctly and, left
   * untouched, saves back exactly what it read. The derivation applies from the
   * first interaction onward, so an admin who opens the dialog and closes it
   * cannot rewrite a representation they never touched.
   */
  function emit(memberIds: readonly string[]) {
    const everyone = hasGoverned && memberIds.length === governed.length;

    onChange({ visibility: everyone ? "public" : "private", memberIds });
  }

  function handleToggleAll() {
    emit(allSelected ? [] : governed.map((member) => member.id));
  }

  function handleToggle(userId: string) {
    emit(
      selected.has(userId)
        ? access.memberIds.filter((id) => id !== userId)
        : [...access.memberIds, userId],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-ink-900">
        Who can access this {noun}
      </span>

      <div className="flex min-h-touch items-center rounded-md px-1 can-hover:min-h-9">
        <Checkbox
          label="Everyone in the workspace"
          checked={allSelected}
          /*
           * `mixed` rather than unchecked while partially selected, so the
           * first click on a half-filled list reads as "include everyone"
           * instead of ambiguously toggling from a state it does not describe.
           */
          indeterminate={someSelected && !allSelected}
          disabled={disabled || !hasGoverned}
          onChange={handleToggleAll}
        />
      </div>

      <Separator />

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
        {summarize(selectedCount, allSelected, noun)}
      </p>
    </div>
  );
}

/**
 * The consequence, in words.
 *
 * The "including anyone added later" clause is the one thing the checkboxes
 * cannot show, and it is the real difference between a fully ticked list and
 * every name ticked individually.
 */
function summarize(
  selectedCount: number,
  allSelected: boolean,
  noun: string,
): string {
  if (allSelected) {
    return `Every member of the workspace can see this ${noun}, including anyone added later.`;
  }

  if (selectedCount === 0) {
    return `Only admins will be able to see this ${noun}.`;
  }

  return `${String(selectedCount)} member${selectedCount === 1 ? "" : "s"} plus all admins can see this ${noun}.`;
}

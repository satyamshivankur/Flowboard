import { Check, ChevronDown } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Menu } from "@/components/ui/Menu";
import { useSession } from "@/controllers/hooks/useSession";
import { cn } from "@/lib/cn";

/**
 * The user switcher.
 *
 * Switching is synchronous and changes nothing in the domain — only which user
 * the selectors evaluate against — so the tree, board and any open drawer
 * re-resolve on the next render with no reload (Requirement 8.3).
 *
 * This is the control the brief's 30-second demo turns on, so the role is on
 * the trigger itself rather than hidden in the menu: "Alice, admin" versus
 * "Bob, member" is the whole point (Requirement 8.2, 8.14).
 */
export function UserSwitcher() {
  const { currentUser, members, switchUser } = useSession();

  if (!currentUser) return null;

  return (
    <Menu
      align="end"
      /*
       * The name goes on `Menu`'s `label`, not on an `aria-label` of the button
       * below.
       *
       * `Menu` renders its trigger through `MenuButton as={Fragment}`, which
       * merges the menu's own props onto the child element — and an explicit
       * prop there wins over one the child set itself. So a button with its own
       * `aria-label` had it silently overwritten, and this control announced
       * "Switch user" while the code read as though it announced who was
       * current. Caught by `e2e/permissions.spec.ts`, because jsdom tests all
       * matched the name as a substring and a substring of the short label is
       * still a substring of the long one.
       *
       * It matters most where it was least visible: below `sm` the name and
       * role are not rendered at all, so the accessible name is the only thing
       * telling a screen-reader user who they are acting as (Requirement 8.2).
       */
      label={`Switch user — currently ${currentUser.name}, ${currentUser.roleLabel}`}
      trigger={
        <button
          type="button"
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md py-1 pl-1 pr-1.5",
            "transition-colors motion-reduce:transition-none",
            "can-hover:hover:bg-surface-hover",
            "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2",
            "coarse-pointer:min-h-touch",
          )}
        >
          <Avatar
            name={currentUser.name}
            avatarToken={currentUser.avatarToken}
            size="sm"
          />

          {/* Name and role appear from `sm`; the avatar alone carries it on a
              phone, where the top bar has no room for two lines of text. */}
          <span className="hidden min-w-0 flex-col items-start sm:flex">
            <span className="max-w-32 truncate text-xs font-medium leading-tight text-ink-900">
              {currentUser.name}
            </span>
            <span className="text-[0.625rem] leading-tight text-ink-400">
              {currentUser.roleLabel}
            </span>
          </span>

          <ChevronDown
            className="size-icon-sm shrink-0 text-ink-400"
            strokeWidth={1.75}
            aria-hidden
          />
        </button>
      }
      items={members.map((member) => ({
        id: member.id,
        label: `${member.name} · ${member.roleLabel}`,
        icon: member.isCurrent ? Check : undefined,
        onSelect: () => {
          switchUser(member.id);
        },
      }))}
    />
  );
}

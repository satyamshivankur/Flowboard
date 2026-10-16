import type { AvatarColorToken } from "@/config/avatars";
import { cn } from "@/lib/cn";

import { Avatar, type AvatarSize } from "./Avatar";
import { Tooltip } from "./Tooltip";

export interface AvatarGroupMember {
  readonly id: string;
  readonly name: string;
  readonly avatarToken: AvatarColorToken;
}

export interface AvatarGroupProps {
  readonly users: readonly AvatarGroupMember[];
  /** Avatars shown before collapsing into a `+n` chip. */
  readonly max?: number;
  readonly size?: AvatarSize;
  readonly className?: string;
}

const OVERFLOW_SIZE: Record<AvatarSize, string> = {
  xs: "size-5 text-[0.625rem]",
  sm: "size-6 text-xs",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
};

export function AvatarGroup({
  users,
  max = 3,
  size = "sm",
  className,
}: AvatarGroupProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const hidden = users.slice(max);

  return (
    // Negative spacing overlaps the avatars; the ring on each one separates
    // them visually without needing a border per avatar.
    <span className={cn("flex items-center -space-x-1.5", className)}>
      {visible.map((user) => (
        <Avatar
          key={user.id}
          name={user.name}
          avatarToken={user.avatarToken}
          size={size}
          showTooltip
        />
      ))}

      {hidden.length > 0 && (
        <Tooltip content={hidden.map((user) => user.name).join(", ")}>
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full",
              "bg-surface-active font-semibold text-ink-600 ring-2 ring-surface",
              OVERFLOW_SIZE[size],
            )}
            role="img"
            aria-label={`${String(hidden.length)} more: ${hidden
              .map((user) => user.name)
              .join(", ")}`}
          >
            <span aria-hidden>+{hidden.length}</span>
          </span>
        </Tooltip>
      )}
    </span>
  );
}

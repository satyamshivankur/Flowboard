import {
  AVATAR_TOKEN_CLASSES,
  initialsOf,
  type AvatarColorToken,
} from "@/config/avatars";
import { cn } from "@/lib/cn";

import { Tooltip } from "./Tooltip";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

export interface AvatarProps {
  readonly name: string;
  readonly avatarToken: AvatarColorToken;
  readonly size?: AvatarSize;
  readonly showTooltip?: boolean;
  readonly className?: string;
}

const SIZE: Record<AvatarSize, string> = {
  xs: "size-5 text-[0.625rem]",
  sm: "size-6 text-xs",
  md: "size-8 text-sm",
  lg: "size-10 text-base",
};

/**
 * An initials avatar.
 *
 * Deterministic: the colour comes from the user's `avatarToken` rather than
 * from hashing their name, so a rename does not silently recolour them.
 */
export function Avatar({
  name,
  avatarToken,
  size = "sm",
  showTooltip = false,
  className,
}: AvatarProps) {
  const avatar = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        "ring-2 ring-surface",
        AVATAR_TOKEN_CLASSES[avatarToken],
        SIZE[size],
        className,
      )}
      // The name is on the wrapper rather than in the text, so a screen reader
      // announces "Alice Nguyen" instead of spelling out "AN".
      role="img"
      aria-label={name}
    >
      <span aria-hidden>{initialsOf(name)}</span>
    </span>
  );

  if (!showTooltip) return avatar;

  return <Tooltip content={name}>{avatar}</Tooltip>;
}

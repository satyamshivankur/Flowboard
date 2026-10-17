import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface InlineReadOnlyProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

/**
 * The read-only form of an inline field: the same badge, no interactivity.
 *
 * Not a disabled button. A disabled button still absorbs the click, and on a
 * card or a row the click it would absorb is the one that opens the drawer
 * (Requirement 7.10, 15.4).
 */
export function InlineReadOnly({ children, className }: InlineReadOnlyProps) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      {children}
    </span>
  );
}

export interface InlineEmptyProps {
  /** What to offer when there is nothing to show — "Set date", "Assign". */
  readonly label: string;
  readonly icon?: ReactNode;
}

/**
 * The placeholder for an empty inline field.
 *
 * `DueDateChip` and `AvatarGroup` both render `null` when they have nothing,
 * which is right for a read-only row and useless for an editable one: an
 * undated task would have had no target to click. This is the smallest thing
 * that still reads as "there is something to set here".
 */
export function InlineEmpty({ label, icon }: InlineEmptyProps) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-400">
      {icon}
      <span>{label}</span>
    </span>
  );
}

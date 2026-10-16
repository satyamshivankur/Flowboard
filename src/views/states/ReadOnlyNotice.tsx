import { Lock } from "lucide-react";

import { cn } from "@/lib/cn";

export interface ReadOnlyNoticeProps {
  /** Why editing is refused. Nothing renders when editing is permitted. */
  readonly reason: string | undefined;
  readonly subject: string;
  readonly className?: string;
}

/**
 * A banner stating that a surface is read-only, and why.
 *
 * The alternative was making every disabled control explain itself. That works
 * in a menu, where there is room for a line of helper text, but not on an
 * icon-only button in a column header — and appending the reason to its
 * accessible name turns "Add task to To do" into a sentence.
 *
 * One banner per surface says it once, says it visibly, and says it without
 * hover — which is the part `title` alone cannot do on a touch device
 * (Requirement 8.11, 8.12, 17.2, 20.10).
 *
 * Shaped to match the drawer's own read-only strip, so the two surfaces explain
 * the same situation the same way (Requirement 13.6).
 */
export function ReadOnlyNotice({
  reason,
  subject,
  className,
}: ReadOnlyNoticeProps) {
  if (reason === undefined) return null;

  return (
    <p
      className={cn(
        "flex shrink-0 items-center gap-1.5 bg-warning-50 px-3 py-2",
        "text-xs text-warning-700 md:px-6",
        className,
      )}
    >
      <Lock className="size-icon-sm shrink-0" strokeWidth={1.75} aria-hidden />
      {reason} — this {subject} is read-only.
    </p>
  );
}

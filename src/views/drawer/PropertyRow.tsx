import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

export interface PropertyRowProps {
  readonly label: string;
  readonly icon?: LucideIcon | undefined;
  /** Shows a spinner beside the label while this field's save is in flight. */
  readonly pending?: boolean | undefined;
  readonly children: ReactNode;
}

/**
 * One label/value pair in the drawer.
 *
 * A fixed two-column grid with a uniform row height, so the property block
 * reads as a single table rather than a stack of differently sized controls
 * (Requirement 7.6).
 *
 * The pending indicator sits on the row rather than inside the control, so a
 * select does not change size mid-save and shift the rows below it
 * (Requirement 7.7, 14.7).
 */
export function PropertyRow({
  label,
  icon: Icon,
  pending = false,
  children,
}: PropertyRowProps) {
  return (
    <div
      className={cn(
        "grid items-center gap-2",
        // Label column fixed, value column takes the rest. Stacks below `sm`,
        // where a two-column grid leaves the value too narrow to use.
        "grid-cols-1 sm:grid-cols-[7rem_1fr]",
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && (
          <Icon
            className="size-icon-sm shrink-0 text-ink-400"
            strokeWidth={1.75}
            aria-hidden
          />
        )}
        <span className="text-xs font-medium text-ink-600">{label}</span>
        {pending && <Spinner size="xs" className="text-ink-400" />}
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

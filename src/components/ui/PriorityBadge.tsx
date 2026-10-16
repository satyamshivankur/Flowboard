import { PRIORITY_CONFIG, type Priority } from "@/config/priorities";
import { cn } from "@/lib/cn";

export type PriorityBadgeVariant = "flag" | "pill" | "dot";

export interface PriorityBadgeProps {
  readonly priority: Priority;
  readonly variant?: PriorityBadgeVariant;
  readonly size?: "sm" | "md";
  readonly showLabel?: boolean;
  readonly className?: string;
}

/**
 * Priority, rendered from the shared config.
 *
 * Both the colour and the icon come from `PRIORITY_CONFIG`, so this badge, the
 * table row and the drawer picker cannot disagree (Requirement 13.6).
 *
 * Colour is always paired with an icon or a label, never used alone — a
 * red-only indicator is invisible to a red-green colourblind user
 * (Requirement 17.7).
 */
export function PriorityBadge({
  priority,
  variant = "flag",
  size = "sm",
  showLabel = false,
  className,
}: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];
  const Icon = config.icon;
  const iconSize = size === "sm" ? "size-icon-sm" : "size-icon-md";

  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span
          className={cn("size-1.5 shrink-0 rounded-full", config.classes.dot)}
          aria-hidden
        />
        <span className="text-xs text-ink-600">{config.label}</span>
      </span>
    );
  }

  if (variant === "pill") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1 ring-inset",
          "text-xs font-medium",
          config.classes.soft,
          className,
        )}
      >
        <Icon className={iconSize} strokeWidth={2} aria-hidden />
        {config.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        config.classes.text,
        className,
      )}
    >
      <Icon className={iconSize} strokeWidth={2} aria-hidden />
      {showLabel ? (
        <span className="text-xs font-medium">{config.label}</span>
      ) : (
        <span className="sr-only">{`Priority: ${config.label}`}</span>
      )}
    </span>
  );
}

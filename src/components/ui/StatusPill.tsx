import {
  STATUS_TOKEN_CLASSES,
  type StatusColorToken,
} from "@/config/statusCategories";
import { cn } from "@/lib/cn";

export type StatusPillVariant = "pill" | "dot" | "dot-label";

export interface StatusPillProps {
  readonly name: string;
  readonly colorToken: StatusColorToken;
  readonly variant?: StatusPillVariant;
  readonly size?: "sm" | "md";
  readonly className?: string;
}

/**
 * A list's status, rendered from the shared token map.
 *
 * Takes the token rather than a `Status` entity, so the design system stays
 * free of domain types and the component can be exercised in Storybook from
 * plain props (Requirement 11.4).
 */
export function StatusPill({
  name,
  colorToken,
  variant = "pill",
  size = "sm",
  className,
}: StatusPillProps) {
  const classes = STATUS_TOKEN_CLASSES[colorToken];

  if (variant === "dot") {
    return (
      <span
        className={cn("inline-flex items-center", className)}
        title={name}
      >
        <span
          className={cn("size-2 shrink-0 rounded-full", classes.dot)}
          aria-hidden
        />
        {/* The name still reaches assistive technology, since colour alone
            cannot convey status (Requirement 17.7). */}
        <span className="sr-only">{name}</span>
      </span>
    );
  }

  if (variant === "dot-label") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span
          className={cn("size-2 shrink-0 rounded-full", classes.dot)}
          aria-hidden
        />
        <span
          className={cn(
            "truncate font-medium text-ink-900",
            size === "sm" ? "text-xs" : "text-sm",
          )}
        >
          {name}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ring-1 ring-inset",
        "font-medium",
        size === "sm" ? "text-xs" : "text-sm",
        classes.soft,
        className,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", classes.dot)}
        aria-hidden
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

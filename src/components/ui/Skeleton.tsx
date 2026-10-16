import { cn } from "@/lib/cn";

export type SkeletonVariant = "text" | "card" | "row" | "tree" | "column";

export interface SkeletonProps {
  readonly variant?: SkeletonVariant;
  /** Repeats for the variants that represent a list. */
  readonly lines?: number;
  readonly className?: string;
}

const BASE =
  "animate-pulse rounded bg-surface-active motion-reduce:animate-none";

/** Indent spacers for the tree skeleton, as classes rather than inline widths. */
const TREE_INDENT = ["w-0", "w-4", "w-8"] as const;

/**
 * Loading placeholders.
 *
 * Each variant is sized to the real layout it stands in for, so the skeleton
 * does not collapse into the final content and shift everything around it
 * (Requirement 14.1). That means these dimensions have to be kept in step with
 * the components they shadow — a card skeleton that is the wrong height is
 * worse than no skeleton.
 */
export function Skeleton({
  variant = "text",
  lines = 3,
  className,
}: SkeletonProps) {
  if (variant === "text") {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={cn(
              BASE,
              "h-3",
              // A short last line reads as a paragraph; uniform bars read as a
              // loading grid. Class-based rather than an inline width, since
              // inline `style` is reserved for the two documented dnd-kit and
              // resizer exceptions (Requirement 13.4).
              index === lines - 1 ? "w-3/5" : "w-full",
            )}
          />
        ))}
      </div>
    );
  }

  if (variant === "card") {
    // Mirrors TaskCard: p-3, title over a meta row.
    return (
      <div
        className={cn(
          "rounded-lg bg-surface p-3 ring-1 ring-border",
          className,
        )}
      >
        <div className={cn(BASE, "h-3.5 w-4/5")} />
        <div className="mt-2 flex items-center gap-2">
          <div className={cn(BASE, "h-3 w-12")} />
          <div className={cn(BASE, "h-3 w-16")} />
          <div className={cn(BASE, "ml-auto size-6 rounded-full")} />
        </div>
      </div>
    );
  }

  if (variant === "row") {
    // Mirrors the table row height.
    return (
      <div className={cn("flex flex-col", className)}>
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-3 border-b border-border px-3 density-compact:h-9"
          >
            <div className={cn(BASE, "h-3 flex-1")} />
            <div className={cn(BASE, "h-3 w-20")} />
            <div className={cn(BASE, "size-6 rounded-full")} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "tree") {
    // Mirrors the sidebar's h-8 rows, indented in a plausible tree shape.
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className="flex h-8 items-center gap-2 px-2">
            <div className={cn("shrink-0", TREE_INDENT[index % 3])} />
            <div className={cn(BASE, "size-icon-md shrink-0 rounded-sm")} />
            <div className={cn(BASE, "h-3 flex-1")} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex w-column shrink-0 flex-col gap-2", className)}>
      <div className="flex items-center gap-2 px-1">
        <div className={cn(BASE, "size-2 rounded-full")} />
        <div className={cn(BASE, "h-3 w-24")} />
      </div>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} variant="card" />
      ))}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly size?: "sm" | "md";
  /**
   * Renders as a drop target. An empty kanban column has to accept a card, so
   * its empty state cannot be inert decoration (Requirement 4.9).
   */
  readonly isDropTarget?: boolean;
  readonly isDragOver?: boolean;
  readonly className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "md",
  isDropTarget = false,
  isDragOver = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "gap-1.5 p-4" : "gap-2 p-6",
        isDropTarget &&
          "rounded-lg border border-dashed transition-colors motion-reduce:transition-none",
        isDropTarget && (isDragOver ? "border-brand-600 bg-brand-50" : "border-border"),
        className,
      )}
    >
      <Icon
        className={cn(
          "text-ink-300",
          size === "sm" ? "size-icon-lg" : "size-6",
        )}
        strokeWidth={1.5}
        aria-hidden
      />

      <p
        className={cn(
          "font-medium text-ink-900",
          size === "sm" ? "text-xs" : "text-sm",
        )}
      >
        {title}
      </p>

      {description !== undefined && (
        <p className="max-w-xs text-xs text-ink-600">{description}</p>
      )}

      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";
export type BadgeVariant = "solid" | "soft" | "outline";

export interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly variant?: BadgeVariant;
  readonly size?: "sm" | "md";
  readonly icon?: LucideIcon;
  readonly children: ReactNode;
  readonly className?: string;
}

/*
 * Tone × variant as a nested lookup record. Enumerable by reading it, and the
 * compiler rejects a combination that has no entry (Requirement 11.9).
 */
const STYLES: Record<BadgeVariant, Record<BadgeTone, string>> = {
  solid: {
    neutral: "bg-ink-600 text-white",
    brand: "bg-brand-600 text-white",
    success: "bg-success-600 text-white",
    warning: "bg-warning-600 text-white",
    danger: "bg-danger-600 text-white",
    info: "bg-info-600 text-white",
  },
  soft: {
    neutral: "bg-surface-sunken text-ink-600",
    brand: "bg-brand-50 text-brand-700",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
    danger: "bg-danger-50 text-danger-700",
    info: "bg-info-50 text-info-700",
  },
  outline: {
    neutral: "text-ink-600 ring-1 ring-inset ring-border",
    brand: "text-brand-700 ring-1 ring-inset ring-brand-600/30",
    success: "text-success-700 ring-1 ring-inset ring-success-600/30",
    warning: "text-warning-700 ring-1 ring-inset ring-warning-600/30",
    danger: "text-danger-700 ring-1 ring-inset ring-danger-600/30",
    info: "text-info-700 ring-1 ring-inset ring-info-600/30",
  },
};

export function Badge({
  tone = "neutral",
  variant = "soft",
  size = "sm",
  icon: Icon,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-sm",
        STYLES[variant][tone],
        className,
      )}
    >
      {Icon && (
        <Icon className="size-icon-sm shrink-0" strokeWidth={2} aria-hidden />
      )}
      {children}
    </span>
  );
}

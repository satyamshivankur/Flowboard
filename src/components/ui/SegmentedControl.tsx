import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: LucideIcon;
}

export interface SegmentedControlProps<T extends string> {
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly size?: "sm" | "md";
  /** Required: the group needs a name for assistive technology. */
  readonly ariaLabel: string;
  /** Hide labels, leaving icons only. Each option keeps its accessible name. */
  readonly iconOnly?: boolean;
  readonly className?: string;
}

/**
 * A segmented toggle — the board/list view switcher, and the density control.
 *
 * Uses `role="tablist"` semantics via radio inputs rather than buttons, so
 * arrow-key navigation between options comes from the platform instead of
 * being hand-rolled.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  ariaLabel,
  iconOnly = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md bg-surface-sunken p-0.5 ring-1 ring-border",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={iconOnly ? option.label : undefined}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded font-medium",
              "transition-colors motion-reduce:transition-none",
              "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-1",
              "coarse-pointer:min-h-touch coarse-pointer:px-3",
              size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm",
              isActive
                ? "bg-surface text-ink-900 shadow-card"
                : "text-ink-600 can-hover:hover:text-ink-900",
            )}
          >
            {Icon && (
              <Icon className="size-icon-md shrink-0" strokeWidth={1.75} aria-hidden />
            )}
            {!iconOnly && option.label}
          </button>
        );
      })}
    </div>
  );
}

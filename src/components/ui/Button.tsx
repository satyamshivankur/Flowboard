import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { cn } from "@/lib/cn";

import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: LucideIcon;
  readonly iconPosition?: "leading" | "trailing";
  readonly loading?: boolean;
  readonly fullWidth?: boolean;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly ref?: Ref<HTMLButtonElement>;
}

/*
 * Variants as a typed lookup record rather than inline conditionals, so the set
 * of valid values is enumerable by reading one declaration (Requirement 11.9).
 */
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-card can-hover:hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "bg-surface-raised text-ink-900 ring-1 ring-border can-hover:hover:bg-surface-hover active:bg-surface-active",
  ghost:
    "text-ink-600 can-hover:hover:bg-surface-hover can-hover:hover:text-ink-900 active:bg-surface-active",
  danger:
    "bg-danger-600 text-white shadow-card can-hover:hover:bg-danger-700 active:bg-danger-700",
};

/*
 * Heights come from the Tailwind scale, so every value is rem. `h-9` is
 * 2.25rem and `h-8` is 2rem — both below the 2.75rem touch minimum, which is
 * why the coarse-pointer floor is applied unconditionally below.
 */
const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-sm",
  md: "h-9 gap-2 px-3 text-sm",
};

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: "size-icon-sm",
  md: "size-icon-md",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconPosition = "leading",
  loading = false,
  fullWidth = false,
  disabled = false,
  type = "button",
  children,
  className,
  ref,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium",
        "transition-colors motion-reduce:transition-none",
        "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2",
        // Touch floor. Applied by pointer capability rather than by viewport,
        // because a tablet at desktop width still has fingers (Req 20.9).
        "coarse-pointer:min-h-touch",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {/*
        The spinner replaces the leading icon rather than being appended, so the
        button does not change width mid-request and shift the layout around it
        (Requirement 14.7).
      */}
      {loading ? (
        <Spinner size={size === "sm" ? "xs" : "sm"} />
      ) : (
        Icon &&
        iconPosition === "leading" && (
          <Icon className={ICON_SIZE[size]} strokeWidth={1.75} aria-hidden />
        )
      )}

      {children}

      {!loading && Icon && iconPosition === "trailing" && (
        <Icon className={ICON_SIZE[size]} strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}

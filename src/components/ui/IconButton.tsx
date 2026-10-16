import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, Ref } from "react";

import { cn } from "@/lib/cn";

import { Spinner } from "./Spinner";
import { Tooltip } from "./Tooltip";

export type IconButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type IconButtonSize = "xs" | "sm" | "md";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  readonly icon: LucideIcon;
  /**
   * The accessible name. **Required** — which makes an unlabelled icon-only
   * control a type error rather than something a review has to catch
   * (Requirement 13.11, 17.1).
   */
  readonly label: string;
  readonly variant?: IconButtonVariant;
  readonly size?: IconButtonSize;
  readonly loading?: boolean;
  /** Show the label on hover. Suppressed on coarse pointers by `Tooltip`. */
  readonly tooltip?: boolean;
  readonly className?: string;
  readonly ref?: Ref<HTMLButtonElement>;
}

const VARIANT: Record<IconButtonVariant, string> = {
  primary: "bg-brand-600 text-white can-hover:hover:bg-brand-700",
  secondary:
    "bg-surface-raised text-ink-600 ring-1 ring-border can-hover:hover:bg-surface-hover can-hover:hover:text-ink-900",
  ghost:
    "text-ink-400 can-hover:hover:bg-surface-hover can-hover:hover:text-ink-900",
  danger: "text-danger-600 can-hover:hover:bg-danger-50",
};

const SIZE: Record<IconButtonSize, string> = {
  xs: "size-6",
  sm: "size-7",
  md: "size-9",
};

const ICON: Record<IconButtonSize, string> = {
  xs: "size-icon-sm",
  sm: "size-icon-md",
  md: "size-icon-md",
};

export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  size = "sm",
  loading = false,
  tooltip = true,
  disabled = false,
  type = "button",
  className,
  ref,
  ...rest
}: IconButtonProps) {
  const button = (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-label={label}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        "transition-colors motion-reduce:transition-none",
        "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2",
        // Every size below is under the touch minimum, so the floor matters
        // more here than on Button (Requirement 20.9).
        "coarse-pointer:size-touch",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {loading ? (
        <Spinner size="xs" />
      ) : (
        <Icon className={ICON[size]} strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );

  if (!tooltip) return button;

  return <Tooltip content={label}>{button}</Tooltip>;
}

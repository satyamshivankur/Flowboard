import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";

import { IconButton } from "./IconButton";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

/**
 * Toast props.
 *
 * Structurally compatible with `ToastContext`'s model, but declared here
 * independently so the component does not import a Context type and stays
 * renderable from plain props (Requirement 11.4).
 */
export interface ToastProps {
  readonly id: string;
  readonly tone: ToastTone;
  readonly title: string;
  readonly description?: string;
  readonly action?: ToastAction;
  readonly onDismiss: (id: string) => void;
}

const TONE_ICON: Record<ToastTone, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE_ACCENT: Record<ToastTone, string> = {
  success: "text-success-600",
  error: "text-danger-600",
  warning: "text-warning-600",
  info: "text-info-600",
};

export function Toast({
  id,
  tone,
  title,
  description,
  action,
  onDismiss,
}: ToastProps) {
  const Icon = TONE_ICON[tone];

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full items-start gap-2.5 rounded-lg",
        "bg-surface p-3 shadow-popover ring-1 ring-border",
      )}
    >
      <Icon
        className={cn("mt-0.5 size-icon-md shrink-0", TONE_ACCENT[tone])}
        strokeWidth={2}
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium text-ink-900">{title}</p>

        {description !== undefined && (
          <p className="text-xs text-ink-600">{description}</p>
        )}

        {action !== undefined && (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              onDismiss(id);
            }}
            className={cn(
              "mt-1 self-start rounded text-xs font-semibold text-brand-600",
              "can-hover:hover:text-brand-700",
              "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2",
            )}
          >
            {action.label}
          </button>
        )}
      </div>

      <IconButton
        icon={X}
        label="Dismiss"
        size="xs"
        tooltip={false}
        onClick={() => {
          onDismiss(id);
        }}
      />
    </div>
  );
}

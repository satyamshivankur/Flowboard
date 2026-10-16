import { CalendarClock } from "lucide-react";

import { cn } from "@/lib/cn";
import { dueDateTone, formatDueDate, type DueDateTone } from "@/lib/date";

export interface DueDateChipProps {
  readonly date: string | null;
  /** Reference time. Passed in so rendering is deterministic in tests. */
  readonly now: string;
  readonly variant?: "chip" | "inline";
  readonly size?: "sm" | "md";
  readonly showIcon?: boolean;
  readonly className?: string;
}

/*
 * Overdue and due-today are the only two states worth colouring. Colouring
 * everything would dilute the signal until none of it reads as urgent
 * (Requirement 15.8).
 */
const TONE: Record<DueDateTone, string> = {
  overdue: "text-danger-600",
  today: "text-warning-600",
  upcoming: "text-ink-600",
  none: "text-ink-400",
};

const CHIP_TONE: Record<DueDateTone, string> = {
  overdue: "bg-danger-50 text-danger-700 ring-danger-600/20",
  today: "bg-warning-50 text-warning-700 ring-warning-600/20",
  upcoming: "bg-surface-sunken text-ink-600 ring-border",
  none: "bg-surface-sunken text-ink-400 ring-border",
};

/** Suffix read by assistive technology, so the tone is not colour-only. */
const TONE_LABEL: Record<DueDateTone, string> = {
  overdue: " (overdue)",
  today: " (due today)",
  upcoming: "",
  none: "",
};

export function DueDateChip({
  date,
  now,
  variant = "inline",
  size = "sm",
  showIcon = true,
  className,
}: DueDateChipProps) {
  if (date === null) return null;

  const tone = dueDateTone(date, now);
  const label = formatDueDate(date, now);
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  const content = (
    <>
      {showIcon && (
        <CalendarClock
          className="size-icon-sm shrink-0"
          strokeWidth={1.75}
          aria-hidden
        />
      )}
      <span>{label}</span>
      <span className="sr-only">{TONE_LABEL[tone]}</span>
    </>
  );

  if (variant === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1 ring-inset",
          "font-medium",
          textSize,
          CHIP_TONE[tone],
          className,
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        textSize,
        TONE[tone],
        className,
      )}
    >
      {content}
    </span>
  );
}

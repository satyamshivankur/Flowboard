import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  CircleDashed,
  Minus,
  type LucideIcon,
} from "lucide-react";

export type Priority = "urgent" | "high" | "normal" | "low" | "none";

export interface PriorityConfig {
  readonly value: Priority;
  readonly label: string;
  /** Design-token suffix. Semantic identity, not a class — see `classes`. */
  readonly token: string;
  readonly icon: LucideIcon;
  /** Sort rank, ascending. This is what comparators read — never alphabetical. */
  readonly rank: number;
  /**
   * Complete Tailwind class strings.
   *
   * Written out in full rather than composed as `text-${token}`, because
   * Tailwind resolves classes by scanning source text: an interpolated name
   * generates no CSS at all. Verified against the built stylesheet — the
   * interpolated form produced no rule, which would have shipped unstyled
   * badges rather than a build error.
   *
   * Keeping them here rather than in each component is what makes the
   * "identical across kanban cards, list rows and drawer" guarantee of
   * Requirement 13.6 structural.
   */
  readonly classes: {
    /** Foreground only, for icons and inline text. */
    readonly text: string;
    /** Tinted pill: background, foreground and ring. */
    readonly soft: string;
    /** Solid dot or bar indicator. */
    readonly dot: string;
  };
}

/**
 * Priorities, as data.
 *
 * `rank` is the reason the list view needs no bespoke comparator and why adding
 * a priority cannot produce an inconsistent sort order (Requirement 5.3, 21.6).
 * `token` is read by both PriorityBadge and TaskRow, which is how identical
 * appearance across surfaces is guaranteed structurally rather than by review
 * (Requirement 13.6).
 */
export const PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  urgent: {
    value: "urgent",
    label: "Urgent",
    token: "priority-urgent",
    icon: ChevronsUp,
    rank: 0,
    classes: {
      text: "text-priority-urgent",
      soft: "bg-danger-50 text-priority-urgent ring-priority-urgent/20",
      dot: "bg-priority-urgent",
    },
  },
  high: {
    value: "high",
    label: "High",
    token: "priority-high",
    icon: ChevronUp,
    rank: 1,
    classes: {
      text: "text-priority-high",
      soft: "bg-warning-50 text-priority-high ring-priority-high/20",
      dot: "bg-priority-high",
    },
  },
  normal: {
    value: "normal",
    label: "Normal",
    token: "priority-normal",
    icon: Minus,
    rank: 2,
    classes: {
      text: "text-priority-normal",
      soft: "bg-info-50 text-priority-normal ring-priority-normal/20",
      dot: "bg-priority-normal",
    },
  },
  low: {
    value: "low",
    label: "Low",
    token: "priority-low",
    icon: ChevronDown,
    rank: 3,
    classes: {
      text: "text-priority-low",
      soft: "bg-surface-sunken text-priority-low ring-priority-low/20",
      dot: "bg-priority-low",
    },
  },
  none: {
    value: "none",
    label: "None",
    token: "priority-none",
    icon: CircleDashed,
    rank: 4,
    classes: {
      text: "text-ink-400",
      soft: "bg-surface-sunken text-ink-400 ring-border",
      dot: "bg-priority-none",
    },
  },
};

/** Every priority, ordered by rank. */
export const PRIORITIES = Object.values(PRIORITY_CONFIG)
  .sort((a, b) => a.rank - b.rank)
  .map((config) => config.value);

export const DEFAULT_PRIORITY: Priority = "none";

export function priorityConfig(priority: Priority): PriorityConfig {
  return PRIORITY_CONFIG[priority];
}

/** Comparator over the semantic ranking, not the string value. */
export function comparePriority(
  a: Priority,
  b: Priority,
  direction: "asc" | "desc" = "asc",
): number {
  const delta = PRIORITY_CONFIG[a].rank - PRIORITY_CONFIG[b].rank;
  return direction === "asc" ? delta : -delta;
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && value in PRIORITY_CONFIG;
}

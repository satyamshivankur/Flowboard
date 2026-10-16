import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  CircleDashed,
  Minus,
  type LucideIcon,
} from 'lucide-react'

export type Priority = 'urgent' | 'high' | 'normal' | 'low' | 'none'

export interface PriorityConfig {
  readonly value: Priority
  readonly label: string
  /** Design-token suffix, used as `text-priority-urgent` etc. */
  readonly token: string
  readonly icon: LucideIcon
  /** Sort rank, ascending. This is what comparators read — never alphabetical. */
  readonly rank: number
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
    value: 'urgent',
    label: 'Urgent',
    token: 'priority-urgent',
    icon: ChevronsUp,
    rank: 0,
  },
  high: {
    value: 'high',
    label: 'High',
    token: 'priority-high',
    icon: ChevronUp,
    rank: 1,
  },
  normal: {
    value: 'normal',
    label: 'Normal',
    token: 'priority-normal',
    icon: Minus,
    rank: 2,
  },
  low: {
    value: 'low',
    label: 'Low',
    token: 'priority-low',
    icon: ChevronDown,
    rank: 3,
  },
  none: {
    value: 'none',
    label: 'None',
    token: 'priority-none',
    icon: CircleDashed,
    rank: 4,
  },
}

/** Every priority, ordered by rank. */
export const PRIORITIES = Object.values(PRIORITY_CONFIG)
  .sort((a, b) => a.rank - b.rank)
  .map((config) => config.value)

export const DEFAULT_PRIORITY: Priority = 'none'

export function priorityConfig(priority: Priority): PriorityConfig {
  return PRIORITY_CONFIG[priority]
}

/** Comparator over the semantic ranking, not the string value. */
export function comparePriority(
  a: Priority,
  b: Priority,
  direction: 'asc' | 'desc' = 'asc',
): number {
  const delta = PRIORITY_CONFIG[a].rank - PRIORITY_CONFIG[b].rank
  return direction === 'asc' ? delta : -delta
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && value in PRIORITY_CONFIG
}

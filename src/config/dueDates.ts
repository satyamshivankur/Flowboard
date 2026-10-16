/**
 * Quick due-date offsets, as data.
 *
 * The card menu and the drawer both read this list, so "Tomorrow" cannot mean
 * one thing in one place and something else in another. Adding "End of week"
 * is an entry here and no code elsewhere (Requirement 15.2, 21.6).
 */
export interface DueDatePreset {
  readonly id: string;
  readonly label: string;
  /** Whole days from the reference `now`, so `0` is today. */
  readonly days: number;
}

export const DUE_DATE_PRESETS: readonly DueDatePreset[] = [
  { id: "today", label: "Today", days: 0 },
  { id: "tomorrow", label: "Tomorrow", days: 1 },
  { id: "next-week", label: "Next week", days: 7 },
];

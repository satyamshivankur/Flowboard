/**
 * The semantic buckets a list's statuses fall into.
 *
 * A list owns its own named statuses ("Backlog", "In review"), but each one
 * declares a category so that cross-list behaviour — the card checkbox moving a
 * task to "done", or status remapping when a task moves between lists — has
 * something stable to reason about (Requirement 2.6, 15.7).
 */
export type StatusCategory = "todo" | "active" | "done";

/** Token keys for status colour. Never a hex literal on the entity itself. */
export type StatusColorToken =
  | "status-todo"
  | "status-active"
  | "status-review"
  | "status-done";

export interface StatusCategoryConfig {
  readonly category: StatusCategory;
  readonly label: string;
  readonly defaultToken: StatusColorToken;
  /** Display order of columns grouped by category. */
  readonly order: number;
  /** True for the terminal category — the one the complete checkbox targets. */
  readonly isTerminal: boolean;
}

export const STATUS_CATEGORY_CONFIG: Record<
  StatusCategory,
  StatusCategoryConfig
> = {
  todo: {
    category: "todo",
    label: "Not started",
    defaultToken: "status-todo",
    order: 0,
    isTerminal: false,
  },
  active: {
    category: "active",
    label: "Active",
    defaultToken: "status-active",
    order: 1,
    isTerminal: false,
  },
  done: {
    category: "done",
    label: "Completed",
    defaultToken: "status-done",
    order: 2,
    isTerminal: true,
  },
};

export const STATUS_CATEGORIES = Object.values(STATUS_CATEGORY_CONFIG)
  .sort((a, b) => a.order - b.order)
  .map((config) => config.category);

/** Every status token, so the Tailwind-safelist check can enumerate them. */
export const STATUS_COLOR_TOKENS: readonly StatusColorToken[] = [
  "status-todo",
  "status-active",
  "status-review",
  "status-done",
];

/**
 * The category a completed task belongs to, resolved from the table rather
 * than hard-coded, so the card checkbox and cross-list status remapping both
 * stay correct if the category set changes (Requirement 15.7, 2.6).
 */
export const TERMINAL_STATUS_CATEGORY: StatusCategory = (() => {
  const terminal = STATUS_CATEGORIES.filter(
    (category) => STATUS_CATEGORY_CONFIG[category].isTerminal,
  );
  const [only] = terminal;

  if (terminal.length !== 1 || !only) {
    throw new Error("Exactly one status category must be terminal");
  }

  return only;
})();

export function isStatusCategory(value: unknown): value is StatusCategory {
  return typeof value === "string" && value in STATUS_CATEGORY_CONFIG;
}

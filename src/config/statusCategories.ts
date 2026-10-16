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

/**
 * Complete Tailwind class strings per status token.
 *
 * Written out in full rather than composed as `bg-${token}`, because Tailwind
 * resolves classes by scanning source text and an interpolated name generates
 * no CSS. One map, read by the kanban column header, the card and the list row,
 * so a status cannot render two ways (Requirement 13.6).
 */
export const STATUS_TOKEN_CLASSES: Record<
  StatusColorToken,
  { readonly dot: string; readonly soft: string; readonly text: string }
> = {
  "status-todo": {
    dot: "bg-status-todo",
    soft: "bg-surface-sunken text-ink-600 ring-border",
    text: "text-status-todo",
  },
  "status-active": {
    dot: "bg-status-active",
    soft: "bg-info-50 text-info-700 ring-status-active/20",
    text: "text-status-active",
  },
  "status-review": {
    dot: "bg-status-review",
    soft: "bg-brand-50 text-brand-700 ring-status-review/20",
    text: "text-status-review",
  },
  "status-done": {
    dot: "bg-status-done",
    soft: "bg-success-50 text-success-700 ring-status-done/20",
    text: "text-status-done",
  },
};

/** Every status token, so the class map above can be checked for completeness. */
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

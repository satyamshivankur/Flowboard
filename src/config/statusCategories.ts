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
  /**
   * The name given to this category's status in a list's default set.
   *
   * Deliberately separate from `label`. The label names the *category* in UI
   * that groups by it ("Not started"); this names the *status* a list actually
   * gets ("To do"). They read differently on purpose, and conflating them
   * would put "Not started" on a kanban column header.
   */
  readonly defaultStatusName: string;
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
    defaultStatusName: "To do",
    defaultToken: "status-todo",
    order: 0,
    isTerminal: false,
  },
  active: {
    category: "active",
    label: "Active",
    defaultStatusName: "In progress",
    defaultToken: "status-active",
    order: 1,
    isTerminal: false,
  },
  done: {
    category: "done",
    label: "Completed",
    defaultStatusName: "Done",
    defaultToken: "status-done",
    order: 2,
    isTerminal: true,
  },
};

export const STATUS_CATEGORIES = Object.values(STATUS_CATEGORY_CONFIG)
  .sort((a, b) => a.order - b.order)
  .map((config) => config.category);

/** One entry of a list's default status set, before it is given ids. */
export interface DefaultStatusTemplate {
  readonly category: StatusCategory;
  readonly name: string;
  readonly color: StatusColorToken;
}

/**
 * The status set every list starts with: one status per category, in category
 * order — "To do", "In progress", "Done" (Requirement 3.3).
 *
 * Derived from the category table rather than written out, so adding a
 * category gives new lists a column for it without a second edit, and the
 * seed fixtures and `containerSlice.create` cannot drift apart about what
 * "default" means (Requirement 21.6, 21.18).
 *
 * A list with no statuses is not a lesser list, it is a broken one: the board
 * has no columns to render and `taskSlice.create` has nothing to file a task
 * under, so there is no route back out. Seeding the set at creation is what
 * keeps that state unreachable.
 */
export const DEFAULT_STATUS_TEMPLATE: readonly DefaultStatusTemplate[] =
  STATUS_CATEGORIES.map((category) => ({
    category,
    name: STATUS_CATEGORY_CONFIG[category].defaultStatusName,
    color: STATUS_CATEGORY_CONFIG[category].defaultToken,
  }));

/**
 * Complete Tailwind class strings per status token.
 *
 * Written out in full rather than composed as `bg-${token}`, because Tailwind
 * resolves classes by scanning source text and an interpolated name generates
 * no CSS. One map, read by the kanban column header, the card and the list row,
 * so a status cannot render two ways (Requirement 13.6).
 *
 * `soft` tints a pill; `surface` tints a whole panel — the kanban column. They
 * are separate entries rather than one reused string because the two differ in
 * what they must carry: a pill sets its own text colour and a `ring`, a panel
 * sets a `border` and leaves text to the ink ramp. Reusing `soft` on a column
 * would have painted every card's container in the pill's text colour.
 *
 * `surface` is a wash of the status's **own** token rather than one of the
 * semantic `-50` ramps that `soft` borrows. That matters at panel size: `soft`
 * pairs `status-review` with `bg-brand-50` and `status-active` with
 * `bg-info-50`, which are `#eef4ff` and `#eaf2fe` — close enough that on a
 * pill the differing text colour carries the distinction, and close enough
 * that two full-height columns tinted with them were indistinguishable. A wash
 * of the token cannot have that problem: the tint *is* the status's colour, so
 * two statuses are as different as their dots are, and a new token needs no
 * new ramp entry.
 *
 * The width of the border lives at the call site; only the colour belongs
 * here, the same split `StatusPill` uses for its `ring-1 ring-inset`.
 */
export const STATUS_TOKEN_CLASSES: Record<
  StatusColorToken,
  {
    readonly dot: string;
    readonly soft: string;
    readonly text: string;
    readonly surface: string;
  }
> = {
  "status-todo": {
    dot: "bg-status-todo",
    soft: "bg-surface-sunken text-ink-600 ring-border",
    text: "text-status-todo",
    surface: "bg-status-todo/10 border-status-todo/25",
  },
  "status-active": {
    dot: "bg-status-active",
    soft: "bg-info-50 text-info-700 ring-status-active/20",
    text: "text-status-active",
    surface: "bg-status-active/10 border-status-active/25",
  },
  "status-review": {
    dot: "bg-status-review",
    soft: "bg-brand-50 text-brand-700 ring-status-review/20",
    text: "text-status-review",
    surface: "bg-status-review/10 border-status-review/25",
  },
  "status-done": {
    dot: "bg-status-done",
    soft: "bg-success-50 text-success-700 ring-status-done/20",
    text: "text-status-done",
    surface: "bg-status-done/10 border-status-done/25",
  },
};

/**
 * The alpha each `surface` wash uses, so a test can composite it honestly.
 *
 * Kept low on purpose. The wash is a family hint; the **border** is what
 * identifies the status, and that split is forced by the palette rather than
 * chosen: `status-active` and `status-review` differ almost entirely in their
 * red channel, so at any alpha subtle enough to sit behind white cards the two
 * washes are about seven RGB units apart — which is to say, not
 * distinguishable. At the border's 25% they are twenty-five apart, which is.
 *
 * Pushing the wash up until the two tints separated would have meant a panel
 * dark enough to fight the cards on it, and would have dragged the header's
 * count below AA on the grey tint. `contrast.test.ts` composites both and
 * asserts the division of labour, so raising this has to come back through it.
 */
export const STATUS_SURFACE_ALPHA = 0.1;

/** The alpha the `surface` border uses. The status signal proper. */
export const STATUS_BORDER_ALPHA = 0.25;

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

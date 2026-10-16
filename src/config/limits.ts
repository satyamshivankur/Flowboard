/**
 * Named limits.
 *
 * Each of these is a number that validation and selectors compare against.
 * Naming them means raising a limit is a one-line change rather than finding
 * every place a literal was inlined (Requirement 21.9, 21.18).
 */

/*
 * These are annotated `: number` rather than left to infer their literal types.
 * They are tunable thresholds, and a literal type lets TypeScript narrow
 * comparisons against them to constants — which turns genuine runtime branches
 * (`MAX_TASK_DEPTH === 1 ? … : …`) into "unnecessary condition" lint errors and
 * invites someone to delete the branch that handles every other value.
 */

/** Max task title length, per the brief. */
export const MAX_TITLE_LEN: number = 500;

/** Max container name length. */
export const MAX_NAME_LEN: number = 120;

/**
 * Subtask nesting depth. 0 would mean no subtasks, 1 is one level, n is n
 * levels. Validation compares `taskDepth(parent) + 1` against this rather than
 * checking `parentTaskId === null`, so raising it needs no new logic.
 */
export const MAX_TASK_DEPTH: number = 1;

/** Max assignees on a single task. */
export const MAX_ASSIGNEES: number = 10;

/** Page size for the simulated pagination on the list view. */
export const PAGE_SIZE: number = 25;

/**
 * Fractional-index spacing. New siblings land GAP apart, and inserting between
 * two neighbours takes their midpoint, so a reorder writes exactly one entity.
 */
export const POSITION_GAP = 1024;

/**
 * When the gap between neighbours falls below this, the sibling group is
 * rebalanced to clean multiples of POSITION_GAP. Floating-point midpoints
 * survive roughly 50 subdivisions before precision becomes a concern; this
 * threshold triggers well before that.
 */
export const POSITION_MIN_GAP = 0.0001;

/** Toast auto-dismiss delay in milliseconds. */
export const TOAST_DURATION_MS = 5000;

/** Debounce for the search input in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 200;

/** Minimum statuses a list must retain — one per category. */
export const MIN_STATUSES_PER_LIST = 3;

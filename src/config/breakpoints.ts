/**
 * Breakpoint values for the few places JavaScript needs them.
 *
 * Tailwind owns breakpoints for styling — `md:w-drawer` needs nothing from this
 * file, and responsive layout should stay in CSS. This module exists only
 * because a small number of decisions are about *behaviour* rather than
 * appearance, and behaviour cannot be expressed in a media query:
 *
 *   - The sidebar is a focus-trapping Headless UI `Dialog` below `lg` and a
 *     static `aside` at `lg` and above. A sheet left open while the viewport
 *     widens would become an invisible focus trap, so something has to observe
 *     the `lg` boundary and close it.
 *   - Storybook's viewport presets are JavaScript config, and deriving them
 *     from the same numbers keeps the workbench honest.
 *
 * Everything else that looked like it needed this — the board's snap paging,
 * the list view's card/table swap, the drawer's sheet/panel swap, dnd-kit's
 * touch sensor — turned out to be achievable with Tailwind variants or with
 * pointer-capability queries. If you are reaching for this module, check first
 * whether a `md:` prefix or the `can-hover` variant does the job.
 *
 * These values duplicate the `--breakpoint-*` tokens in `src/index.css`.
 * `breakpoints.test.ts` parses that file and fails if the two drift, so the
 * duplication is enforced rather than merely intended (Requirement 12.7, 20.3).
 */

/** The breakpoints declared in the `@theme` block. */
export type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl";

/** Minimum width in rem. Mirrors `--breakpoint-*` in `src/index.css`. */
export const BREAKPOINT_REM: Record<Breakpoint, number> = {
  sm: 40,
  md: 48,
  lg: 64,
  xl: 80,
  "2xl": 96,
};

/** `(min-width: 64rem)` — for `matchMedia`. */
export function minWidthQuery(breakpoint: Breakpoint): string {
  return `(min-width: ${String(BREAKPOINT_REM[breakpoint])}rem)`;
}

/**
 * The boundary at which the sidebar stops being a modal sheet and becomes part
 * of the layout. The one breakpoint this app genuinely observes from JS.
 */
export const SIDEBAR_STATIC_BREAKPOINT: Breakpoint = "lg";

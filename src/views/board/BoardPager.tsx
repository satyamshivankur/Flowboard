import { cn } from "@/lib/cn";

export interface BoardPagerProps {
  readonly names: readonly string[];
  readonly activeIndex: number;
  readonly onSelect: (index: number) => void;
}

/**
 * Position in the column set, for the one-column-at-a-time phone layout.
 *
 * Snap paging is invisible without it: a single column fills the viewport, so
 * there is nothing to tell a user that two more sit off-screen, nor how far
 * through them they are (Requirement 4.10, 20.5).
 *
 * Hidden from `md` upward, where the columns are simply all visible.
 */
export function BoardPager({ names, activeIndex, onSelect }: BoardPagerProps) {
  if (names.length < 2) return null;

  const current = names[activeIndex];

  return (
    <nav
      aria-label="Board columns"
      className="flex shrink-0 items-center justify-center gap-2 py-2 md:hidden"
    >
      <p className="text-xs tabular-nums text-ink-400">
        {activeIndex + 1} of {names.length}
        {current !== undefined && (
          <span className="ml-1 text-ink-600">· {current}</span>
        )}
      </p>

      <ul className="flex items-center gap-1">
        {names.map((name, index) => (
          <li key={name} className="flex">
            <button
              type="button"
              aria-label={`Go to ${name}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => {
                onSelect(index);
              }}
              /*
               * The hit area is a full touch target even though the dot is
               * small, which is the only way a 0.375rem dot is tappable
               * (Requirement 20.9).
               */
              className="flex size-touch items-center justify-center rounded-full focus-visible:outline-brand-600 focus-visible:outline-2"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full transition-colors motion-reduce:transition-none",
                  index === activeIndex ? "bg-brand-600" : "bg-border",
                )}
              />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

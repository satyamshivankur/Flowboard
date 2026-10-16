import { ChevronRight } from "lucide-react";

import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

export interface BreadcrumbNode {
  readonly id: string;
  readonly name: string;
}

export interface BreadcrumbsProps {
  readonly path: readonly BreadcrumbNode[];
  readonly className?: string;
}

/**
 * The path to the selected list.
 *
 * Progressive disclosure by breakpoint, done in CSS rather than by measuring:
 * every segment is rendered and the ones that do not fit are hidden. The last
 * segment is always visible, the one before it appears from `md`, and the full
 * path from `lg` (Requirement 20.4).
 *
 * Rendering all of them and hiding with `display: none` keeps the hidden
 * segments out of the accessibility tree too, so a screen reader hears exactly
 * what is on screen.
 */
/**
 * Which breakpoint reveals a given segment.
 *
 * The leaf always shows, its parent from `md`, everything else from `lg`.
 * A lookup rather than a nested ternary, so the rule is readable as data.
 */
function visibilityFor(index: number, lastIndex: number): string {
  if (index === lastIndex) return "flex";
  if (index === lastIndex - 1) return "hidden md:flex";
  return "hidden lg:flex";
}

export function Breadcrumbs({ path, className }: BreadcrumbsProps) {
  if (path.length === 0) return null;

  const lastIndex = path.length - 1;

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1">
        {path.map((node, index) => {
          const isLast = index === lastIndex;
          const visibility = visibilityFor(index, lastIndex);

          return (
            <li
              key={node.id}
              className={cn("min-w-0 items-center gap-1", visibility)}
            >
              {index > 0 && (
                <ChevronRight
                  className={cn(
                    "size-icon-sm shrink-0 text-ink-300",
                    // The separator follows the visibility of the segment it
                    // precedes, or it would float with nothing before it.
                    isLast ? "hidden md:block" : "hidden lg:block",
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
              )}

              <Tooltip content={node.name}>
                <span
                  className={cn(
                    "truncate text-sm",
                    isLast ? "font-semibold text-ink-900" : "text-ink-600",
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {node.name}
                </span>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

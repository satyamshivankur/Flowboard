import { Fragment } from "react";

import { cn } from "@/lib/cn";

export interface HighlightProps {
  readonly text: string;
  /** The matched substring. Empty or absent leaves the text untouched. */
  readonly query: string;
  readonly className?: string;
}

/** Escapes a user-typed string so it can sit inside a `RegExp`. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Text with every occurrence of `query` marked.
 *
 * The query is escaped before it reaches the `RegExp`. Without that, typing
 * `(` into the search field throws on an unterminated group — a crash reachable
 * by a single keystroke.
 *
 * `<mark>` rather than a styled `<span>`: it carries the semantics of a
 * relevance highlight, so the emphasis is not colour-only (Requirement 17.7).
 */
export function Highlight({ text, query, className }: HighlightProps) {
  const needle = query.trim();

  if (needle.length === 0) return <span className={className}>{text}</span>;

  const parts = text.split(new RegExp(`(${escapeForRegExp(needle)})`, "ig"));

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Split with a capture group yields alternating non-match/match
        // segments, so the odd indices are the matches.
        const isMatch = index % 2 === 1;

        return (
          <Fragment key={`${String(index)}-${part}`}>
            {isMatch ? (
              <mark
                className={cn(
                  "rounded-sm bg-brand-100 text-ink-900",
                  // `<mark>` has a UA background; this replaces it rather than
                  // layering on top.
                  "bg-brand-100",
                )}
              >
                {part}
              </mark>
            ) : (
              part
            )}
          </Fragment>
        );
      })}
    </span>
  );
}

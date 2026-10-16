import type { HTMLAttributes, ReactNode, Ref } from "react";

import { cn } from "@/lib/cn";

export interface CardProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "className"
> {
  readonly interactive?: boolean;
  readonly elevated?: boolean;
  readonly selected?: boolean;
  /** The source slot while this card is being dragged. */
  readonly dragging?: boolean;
  /** The floating clone that follows the cursor. */
  readonly overlay?: boolean;
  /** A mutation on this card's subject is in flight (Requirement 14.7). */
  readonly pending?: boolean;
  readonly padding?: "none" | "sm" | "md";
  readonly children: ReactNode;
  readonly className?: string;
  readonly ref?: Ref<HTMLDivElement>;
}

/*
 * Padding per surface type, driven by the primitive and the density variant
 * rather than by per-instance utilities at every call site. That is what keeps
 * spacing consistent instead of merely intending to be (Requirement 13.8).
 */
const PADDING: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-2 density-compact:p-1.5",
  md: "p-3 density-compact:p-2",
};

export function Card({
  interactive = false,
  elevated = false,
  selected = false,
  dragging = false,
  overlay = false,
  pending = false,
  padding = "md",
  children,
  className,
  ref,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      ref={ref}
      /*
       * `aria-busy` rather than only a visual cue: the subdued opacity says
       * nothing to a screen reader (Requirement 14.7, 17.1).
       */
      aria-busy={pending || undefined}
      className={cn(
        "rounded-lg bg-surface ring-1 ring-border",
        "transition-shadow duration-150 motion-reduce:transition-none",
        PADDING[padding],
        elevated && "shadow-card",
        interactive &&
          "can-hover:hover:shadow-card-hover can-hover:hover:ring-border-strong",
        interactive &&
          "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2",
        selected && "ring-2 ring-brand-600",
        /*
         * The source slot keeps its dimensions while dragging, so the column
         * does not collapse and re-expand under the cursor (Requirement 15.6).
         */
        dragging && "opacity-40 border-dashed",
        overlay && "rotate-2 shadow-drag ring-border-strong",
        /*
         * Subdued, not blocked. The card stays readable and its controls stay
         * usable — a 300ms save is not a reason to take the interface away
         * (Requirement 14.7).
         */
        pending && "opacity-60",
        className,
      )}
    >
      {children}
    </div>
  );
}

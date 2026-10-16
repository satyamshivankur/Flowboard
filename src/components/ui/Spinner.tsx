import { cn } from "@/lib/cn";

export type SpinnerSize = "xs" | "sm" | "md";

export interface SpinnerProps {
  readonly size?: SpinnerSize;
  /** Accessible label. Omit when the spinner sits inside a labelled control. */
  readonly label?: string;
  readonly className?: string;
}

const SIZE: Record<SpinnerSize, string> = {
  xs: "size-icon-sm border",
  sm: "size-icon-md border-2",
  md: "size-icon-lg border-2",
};

/**
 * An indeterminate spinner.
 *
 * Built from a bordered circle rather than an SVG so it inherits `currentColor`
 * and needs no fill plumbing when it sits inside a button of any variant.
 */
export function Spinner({ size = "sm", label, className }: SpinnerProps) {
  return (
    <span
      role={label === undefined ? "presentation" : "status"}
      aria-label={label}
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full",
        "border-current border-t-transparent",
        // A spinner that cannot be stilled is the one animation worth keeping
        // under reduced motion, slowed rather than removed.
        "motion-reduce:[animation-duration:2s]",
        SIZE[size],
        className,
      )}
    />
  );
}

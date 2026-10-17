import { cn } from "./cn";

export type InlinePickerSize = "sm" | "md";

const PAD: Record<InlinePickerSize, string> = {
  sm: "-mx-1 px-1 py-0.5",
  md: "-mx-1.5 px-1.5 py-1",
};

/**
 * Classes for a badge, pill, chip or avatar stack that edits in place.
 *
 * A class helper rather than a wrapper component, because the styling has to
 * land on the trigger `<button>` itself. Wrapping the badge in a styled span
 * inside the button put the hover affordance on an element the user never
 * focuses and left the button with no classes at all — which is how the first
 * version managed to look right and assert wrong.
 *
 * It lives in `lib` rather than beside the components because the
 * `react-refresh` rule reserves a component module for components; mixing a
 * plain function in breaks fast refresh for the whole file.
 *
 * Three things it gets right in one place rather than four:
 *
 * 1. **No chevron.** A dropdown caret on every cell would turn a readable row
 *    into a row of controls. The affordance is a hover and focus highlight.
 * 2. **Hover is a hint, never the mechanism.** The caller renders a real
 *    `<button>`, so it is tappable and focusable whether or not the device can
 *    hover; the highlight only makes it discoverable (Requirement 20.10).
 * 3. **Negative margin.** The padding that makes the target big enough would
 *    otherwise shift the badge away from where it sits when read-only, so a
 *    row would visibly reflow the moment it became editable.
 */
export function inlinePickerTriggerClass(
  size: InlinePickerSize = "sm",
  className?: string,
): string {
  return cn(
    "inline-flex max-w-full items-center rounded-md text-left",
    "transition-colors motion-reduce:transition-none",
    "cursor-pointer can-hover:hover:bg-surface-hover",
    "can-hover:hover:ring-1 can-hover:hover:ring-border-strong",
    // Focus has to show the same affordance a mouse gets on hover.
    "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-1",
    PAD[size],
    className,
  );
}

import { Check, Minus } from "lucide-react";
import { useId, type InputHTMLAttributes, type Ref } from "react";

import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "type" | "size"
> {
  readonly label?: string;
  readonly labelHidden?: boolean;
  readonly indeterminate?: boolean;
  readonly size?: "sm" | "md";
  readonly className?: string;
  readonly ref?: Ref<HTMLInputElement>;
}

const BOX: Record<NonNullable<CheckboxProps["size"]>, string> = {
  sm: "size-4",
  md: "size-5",
};

/**
 * A checkbox.
 *
 * The native input is visually hidden but kept in the tree, so it carries all
 * the keyboard and assistive-technology behaviour for free while the visible
 * box is a styled sibling. `peer-*` variants drive the visual state.
 *
 * On a coarse pointer the *label wrapper* grows to the touch minimum rather
 * than the box itself, so the target is large without the checkbox looking
 * oversized (Requirement 20.9).
 */
export function Checkbox({
  label,
  labelHidden = false,
  indeterminate = false,
  size = "sm",
  checked,
  disabled = false,
  id: providedId,
  className,
  ref,
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const Icon = indeterminate ? Minus : Check;

  return (
    <label
      htmlFor={id}
      className={cn(
        "group inline-flex shrink-0 cursor-pointer items-center gap-2",
        "coarse-pointer:min-h-touch coarse-pointer:min-w-touch coarse-pointer:justify-center",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        {...rest}
        id={id}
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-checked={indeterminate ? "mixed" : checked}
        className="peer sr-only"
      />

      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded border",
          "transition-colors motion-reduce:transition-none",
          "border-border-strong bg-surface",
          "peer-checked:border-brand-600 peer-checked:bg-brand-600",
          "peer-focus-visible:outline-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
          "can-hover:group-hover:border-brand-600",
          BOX[size],
        )}
        aria-hidden
      >
        {/*
          Visibility comes from the `checked` prop rather than a `peer-checked:`
          variant. Tailwind's peer variants need the peer to be a previous
          *sibling*, and this icon is nested one level deeper — so the variant
          would silently never apply. This is a controlled component, so the
          prop is authoritative anyway.
        */}
        <Icon
          className={cn(
            "size-icon-sm text-white transition-opacity motion-reduce:transition-none",
            checked === true || indeterminate ? "opacity-100" : "opacity-0",
          )}
          strokeWidth={3}
        />
      </span>

      {label !== undefined && (
        <span className={cn("text-sm text-ink-900", labelHidden && "sr-only")}>
          {label}
        </span>
      )}
    </label>
  );
}

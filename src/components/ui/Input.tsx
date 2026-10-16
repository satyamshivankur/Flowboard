import type { LucideIcon } from "lucide-react";
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";

import { cn } from "@/lib/cn";

export type InputSize = "sm" | "md";

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "size"
> {
  /*
   * Optional props spell out `| undefined`. `exactOptionalPropertyTypes` is on,
   * which is what we want in the Model — an absent field and an explicit
   * `undefined` genuinely differ there — but for component props a caller
   * passing `undefined` to mean "not set" is ordinary React, and forcing a
   * conditional spread at every call site buys nothing.
   */
  readonly label?: string | undefined;
  /** Hides the label visually while keeping it for assistive technology. */
  readonly labelHidden?: boolean | undefined;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly leadingIcon?: LucideIcon | undefined;
  readonly trailingSlot?: ReactNode | undefined;
  readonly inputSize?: InputSize | undefined;
  readonly className?: string | undefined;
  readonly ref?: Ref<HTMLInputElement> | undefined;
}

/*
 * Every dimension for a size lives in one entry, including the padding the
 * input needs to clear each slot.
 *
 * `padX` and `padLeading` are deliberately separate values rather than one
 * composed string: `cn` resolves conflicts through tailwind-merge, where `px-*`
 * *deletes* an earlier `pl-*` entirely. Keeping them apart and applying the
 * slot padding after the base padding is what makes the override land —
 * `twMerge('pl-9', 'px-3')` is `"px-3"`, while `twMerge('px-3', 'pl-9')` keeps
 * both and the generated stylesheet orders `padding-left` after
 * `padding-inline`.
 *
 * `iconInset` matches `padLeading` minus the icon width and a gap, so the text
 * never sits closer to the icon than the icon sits to the border.
 */
const SIZE: Record<
  InputSize,
  {
    readonly height: string;
    readonly padX: string;
    readonly padLeading: string;
    readonly padTrailing: string;
    readonly iconInset: string;
    readonly slotInset: string;
  }
> = {
  sm: {
    height: "h-8",
    padX: "px-2.5",
    padLeading: "pl-8",
    padTrailing: "pr-8",
    iconInset: "pl-2.5",
    slotInset: "pr-1",
  },
  md: {
    height: "h-9",
    padX: "px-3",
    padLeading: "pl-9",
    padTrailing: "pr-9",
    iconInset: "pl-3",
    slotInset: "pr-1.5",
  },
};

export function Input({
  label,
  labelHidden = false,
  error,
  hint,
  leadingIcon: LeadingIcon,
  trailingSlot,
  inputSize = "md",
  id: providedId,
  disabled = false,
  className,
  ref,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedById = `${id}-description`;
  const description = error ?? hint;
  const size = SIZE[inputSize];

  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label
          htmlFor={id}
          className={cn(
            "text-xs font-medium text-ink-600",
            labelHidden && "sr-only",
          )}
        >
          {label}
        </label>
      )}

      <div className="relative">
        {/*
          `inset-y-0` plus `flex items-center` rather than a translate: an
          absolutely positioned child of a flex container gets its static
          position from the container's alignment, which is subtle enough to
          break quietly. Stretching the slot the full height and centring inside
          it does not depend on that, and avoids a transform that can blur an
          icon on fractional device pixel ratios.
        */}
        {LeadingIcon && (
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 flex items-center",
              size.iconInset,
            )}
          >
            <LeadingIcon
              className="size-icon-md text-ink-400"
              strokeWidth={1.75}
              aria-hidden
            />
          </span>
        )}

        <input
          {...rest}
          id={id}
          ref={ref}
          disabled={disabled}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={
            description === undefined ? undefined : describedById
          }
          className={cn(
            "w-full rounded-md bg-surface text-sm text-ink-900 ring-1",
            "placeholder:text-ink-400",
            "transition-shadow motion-reduce:transition-none",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
            // 0.875rem (text-sm) is the floor at which iOS Safari stops zooming
            // the viewport on focus. Smaller text here would break the mobile
            // layout on every tap into a field.
            "coarse-pointer:min-h-touch",
            "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-400",
            error === undefined ? "ring-border" : "ring-danger-600",
            size.height,
            size.padX,
            // Slot padding comes after `padX`, which is the whole point — see
            // the note on SIZE.
            LeadingIcon ? size.padLeading : "",
            trailingSlot ? size.padTrailing : "",
            className,
          )}
        />

        {trailingSlot && (
          <span
            className={cn(
              "absolute inset-y-0 right-0 flex items-center",
              size.slotInset,
            )}
          >
            {trailingSlot}
          </span>
        )}
      </div>

      {description !== undefined && (
        <p
          id={describedById}
          className={cn(
            "text-xs",
            error === undefined ? "text-ink-400" : "text-danger-600",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

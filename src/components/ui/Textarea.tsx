import {
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";

export interface TextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className"
> {
  /* Optional props admit `| undefined` — see the note on `InputProps`. */
  readonly label?: string | undefined;
  readonly labelHidden?: boolean | undefined;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly maxLength?: number | undefined;
  readonly showCount?: boolean | undefined;
  /** Grows with content instead of scrolling. */
  readonly autoGrow?: boolean | undefined;
  /** Cmd/Ctrl+Enter. The explicit save gesture for a multi-line field. */
  readonly onCommit?: (() => void) | undefined;
  /** Escape. Reverts rather than closing an enclosing dialog. */
  readonly onCancel?: (() => void) | undefined;
  readonly className?: string | undefined;
  readonly ref?: Ref<HTMLTextAreaElement> | undefined;
}

export function Textarea({
  label,
  labelHidden = false,
  error,
  hint,
  maxLength,
  showCount = false,
  autoGrow = true,
  onCommit,
  onCancel,
  onKeyDown,
  value,
  rows = 3,
  id: providedId,
  className,
  ref,
  ...rest
}: TextareaProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedById = `${id}-description`;
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const description = error ?? hint;
  const length = typeof value === "string" ? value.length : 0;

  /*
   * Auto-grow resets the height before measuring, because scrollHeight never
   * shrinks on its own — without the reset, deleting text leaves the field
   * stuck at its tallest.
   */
  useLayoutEffect(() => {
    if (!autoGrow) return;

    const element = internalRef.current;

    if (!element) return;

    element.style.height = "auto";
    element.style.height = `${String(element.scrollHeight / 16)}rem`;
  }, [autoGrow, value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(event);

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onCommit?.();
      return;
    }

    if (event.key === "Escape" && onCancel) {
      /*
       * Stop propagation so Escape reverts this field rather than closing the
       * drawer around it. Losing a long description to a stray Escape is the
       * obvious failure mode here (Requirement 7.5).
       */
      event.stopPropagation();
      onCancel();
    }
  }

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

      <textarea
        {...rest}
        id={id}
        ref={(element) => {
          internalRef.current = element;

          if (typeof ref === "function") {
            ref(element);
          } else if (ref) {
            ref.current = element;
          }
        }}
        rows={rows}
        value={value}
        maxLength={maxLength}
        onKeyDown={handleKeyDown}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={description === undefined ? undefined : describedById}
        className={cn(
          "w-full resize-none rounded-md bg-surface px-3 py-2 text-sm text-ink-900 ring-1",
          "placeholder:text-ink-400",
          "transition-shadow motion-reduce:transition-none",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
          "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-400",
          error === undefined ? "ring-border" : "ring-danger-600",
          autoGrow ? "overflow-hidden" : "overflow-auto",
          className,
        )}
      />

      <div className="flex items-start justify-between gap-2">
        {description === undefined ? (
          <span />
        ) : (
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

        {showCount && maxLength !== undefined && (
          <p
            className={cn(
              "shrink-0 text-xs tabular-nums",
              length > maxLength * 0.9 ? "text-warning-600" : "text-ink-400",
            )}
          >
            {length}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}

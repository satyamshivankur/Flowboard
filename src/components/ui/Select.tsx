import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface SelectOption<T extends string> {
  readonly value: T;
  /**
   * Plain text, always. This is the accessible name, the fallback visual and
   * what typeahead matches against — so it stays a string even when `content`
   * renders something richer.
   */
  readonly label: string;
  readonly disabled?: boolean | undefined;
  /**
   * What this option *looks* like: a `StatusPill`, a `PriorityBadge`, an
   * `Avatar` beside a name. Falls back to `label`.
   *
   * Carried on the option rather than supplied as a `renderOption` callback.
   * The callback form forced every caller to look the entity back up by id
   * inside the renderer, and — more importantly — it took the trigger and the
   * list rows as two independent props, so supplying one and forgetting the
   * other produced a dropdown whose closed state and open state disagreed.
   * That is not a mistake worth leaving available.
   */
  readonly content?: ReactNode | undefined;
  /**
   * Overrides `content` on the closed trigger only, for cases where the row
   * can afford more than the button can. Defaults to `content`, so the two
   * match unless a caller deliberately separates them.
   */
  readonly triggerContent?: ReactNode | undefined;
}

export interface SelectProps<T extends string> {
  readonly options: readonly SelectOption<T>[];
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly size?: "sm" | "md";
  readonly label?: string;
  readonly className?: string;
}

const SIZE: Record<NonNullable<SelectProps<string>["size"]>, string> = {
  sm: "min-h-8 px-2.5 py-1 text-xs",
  md: "min-h-9 px-3 py-1 text-sm",
};

/**
 * A single-select dropdown on Headless UI's `Listbox`.
 *
 * Chosen over a native `<select>` because a status option carries a colour dot,
 * a priority option carries an icon and an assignee option carries an avatar —
 * none of which a native select can render, since its `<option>` children may
 * only contain text. The tradeoff is losing the platform picker on mobile, so
 * the rows grow to the touch minimum.
 *
 * Heights are `min-h-*` rather than fixed. A fixed `h-8` row clips a pill or an
 * avatar, which is the sort of thing that only shows up once a caller actually
 * passes one.
 */
export function Select<T extends string>({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  size = "md",
  label,
  className,
}: SelectProps<T>) {
  const selected = options.find((option) => option.value === value);

  /* Early returns rather than a nested ternary in the markup (Req 21.14). */
  function renderTrigger(): ReactNode {
    if (selected === undefined) {
      return <span className="truncate text-ink-400">{placeholder}</span>;
    }

    const content = selected.triggerContent ?? selected.content;

    if (content !== undefined) return content;

    return <span className="truncate">{selected.label}</span>;
  }

  return (
    <Listbox
      value={value}
      /*
       * Typed as `T | null` so Headless UI infers the nullable value type from
       * `value`. A non-null `onChange` would make it infer `T` and reject the
       * placeholder state.
       */
      onChange={(next: T | null) => {
        if (next !== null) onChange(next);
      }}
      disabled={disabled}
    >
      <ListboxButton
        aria-label={label}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 rounded-md",
          "bg-surface text-ink-900 ring-1 ring-border",
          "transition-shadow motion-reduce:transition-none",
          "can-hover:hover:bg-surface-hover",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
          "coarse-pointer:min-h-touch",
          "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-400",
          SIZE[size],
          className,
        )}
      >
        {/*
          `min-w-0` on the wrapper rather than `truncate` on it. Truncating here
          would clamp a custom component's own layout; this lets the content
          decide what to shorten, and plain labels still truncate because the
          fallback above wraps them.
        */}
        <span className="flex min-w-0 flex-1 items-center">
          {renderTrigger()}
        </span>

        <ChevronDown
          className="size-icon-md shrink-0 text-ink-400"
          strokeWidth={1.75}
          aria-hidden
        />
      </ListboxButton>

      <ListboxOptions
        transition
        anchor={{ to: "bottom start", gap: 4 }}
        className={cn(
          "z-50 w-(--button-width) min-w-40 rounded-lg bg-surface p-1",
          "shadow-popover ring-1 ring-border",
          // Matches `Menu`; see the note there on the 120ms floor.
          "transition duration-150 data-closed:opacity-0",
          "motion-reduce:transition-none",
          "focus:outline-none",
        )}
      >
        {options.map((option) => (
          <ListboxOption
            key={option.value}
            value={option.value}
            disabled={option.disabled === true}
            /*
             * The name comes from `label`, not from the rendered content. An
             * avatar-only option would otherwise have no accessible name at
             * all, and a pill would contribute whatever text happened to sit
             * inside it.
             */
            aria-label={option.label}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 text-sm",
              "min-h-9 py-1.5 coarse-pointer:min-h-touch",
              "text-ink-900 data-focus:bg-surface-hover",
              "data-disabled:pointer-events-none data-disabled:opacity-40",
            )}
          >
            <span className="flex min-w-0 flex-1 items-center">
              {option.content ?? (
                <span className="truncate">{option.label}</span>
              )}
            </span>

            {option.value === value && (
              <Check
                className="size-icon-md shrink-0 text-brand-600"
                strokeWidth={2}
                aria-hidden
              />
            )}
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}

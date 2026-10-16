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
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectProps<T extends string> {
  readonly options: readonly SelectOption<T>[];
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly size?: "sm" | "md";
  readonly label?: string;
  /** Custom rendering for an option, e.g. a status dot beside its name. */
  readonly renderOption?: (option: SelectOption<T>) => ReactNode;
  readonly renderValue?: (option: SelectOption<T>) => ReactNode;
  readonly className?: string;
}

const SIZE: Record<NonNullable<SelectProps<string>["size"]>, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3 text-sm",
};

/**
 * A single-select dropdown on Headless UI's `Listbox`.
 *
 * Chosen over a native `<select>` because status options carry a colour dot and
 * priority options carry an icon, neither of which a native select can render.
 * The tradeoff is losing the platform picker on mobile, so the options panel
 * grows its rows to the touch minimum.
 */
export function Select<T extends string>({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  size = "md",
  label,
  renderOption,
  renderValue,
  className,
}: SelectProps<T>) {
  const selected = options.find((option) => option.value === value);

  /* Early returns rather than a nested ternary in the markup (Req 21.14). */
  function renderTrigger(): ReactNode {
    if (selected === undefined) {
      return <span className="text-ink-400">{placeholder}</span>;
    }

    if (renderValue) return renderValue(selected);

    return selected.label;
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
        <span className="truncate">{renderTrigger()}</span>

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
          "transition duration-100 data-closed:opacity-0",
          "motion-reduce:transition-none",
          "focus:outline-none",
        )}
      >
        {options.map((option) => (
          <ListboxOption
            key={option.value}
            value={option.value}
            disabled={option.disabled === true}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 text-sm",
              "h-8 coarse-pointer:min-h-touch",
              "text-ink-900 data-focus:bg-surface-hover",
              "data-disabled:pointer-events-none data-disabled:opacity-40",
            )}
          >
            <span className="truncate">
              {renderOption ? renderOption(option) : option.label}
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

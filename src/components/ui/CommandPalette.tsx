import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
} from "@headlessui/react";
import { Search, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Spinner } from "./Spinner";

export interface CommandPaletteItem {
  readonly id: string;
  /** A node, not a string, so a caller can supply highlighted text. */
  readonly label: ReactNode;
  readonly description?: ReactNode;
  /** Trailing content — a status pill, a due date, a shortcut hint. */
  readonly meta?: ReactNode;
  readonly icon?: LucideIcon;
}

export interface CommandPaletteGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly CommandPaletteItem[];
}

export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly groups: readonly CommandPaletteGroup[];
  readonly onSelect: (itemId: string) => void;
  /** Accessible name for the input, since the palette has no visible title. */
  readonly label: string;
  readonly placeholder?: string;
  /** Shown when a settled query matched nothing. */
  readonly emptyLabel?: string;
  /** Shown before anything has been typed. */
  readonly hintLabel?: ReactNode;
  /** True while the query is still settling, so the spinner is honest. */
  readonly isSearching?: boolean;
  readonly footer?: ReactNode;
}

/**
 * A search palette.
 *
 * Built on Headless UI's `Combobox` inside a `Dialog`, which is what supplies
 * the part that is genuinely hard: `aria-activedescendant` roving focus, arrow
 * and Home/End handling, Enter to choose, Escape to dismiss, and focus returned
 * to whatever opened it. Hand-rolling that is how a palette ends up
 * mouse-only (Requirement 17.1, 17.2).
 *
 * Mobile-first: a full-screen sheet at base, where a floating panel would
 * fight the on-screen keyboard for room, and an anchored panel from `md`.
 * Unprefixed classes describe the sheet (Requirement 20.1, 20.7).
 *
 * Props-only, including the item labels — the primitive knows nothing about
 * tasks or about how a match is highlighted, which is what keeps it
 * reviewable in Storybook without a store (Requirement 11.4).
 */
export function CommandPalette({
  open,
  onClose,
  query,
  onQueryChange,
  groups,
  onSelect,
  label,
  placeholder = "Search…",
  emptyLabel = "No matches.",
  hintLabel,
  isSearching = false,
  footer,
}: CommandPaletteProps) {
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  const hasQuery = query.trim().length > 0;

  return (
    <HeadlessDialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className={cn(
          "fixed inset-0 bg-ink-900/40",
          "transition-opacity duration-150 data-closed:opacity-0",
          "motion-reduce:transition-none",
        )}
      />

      {/*
        Anchored below the top edge from `md` rather than vertically centred:
        a list that grows downward should not move its own input as it does.
      */}
      <div className="fixed inset-0 flex md:items-start md:justify-center md:p-4 md:pt-16">
        <DialogPanel
          transition
          className={cn(
            "flex w-full flex-col overflow-hidden bg-surface",
            // Base: the whole screen. `md`: a capped, floating panel.
            "h-full md:h-auto md:max-h-128 md:max-w-xl md:rounded-xl md:shadow-overlay",
            "pb-[env(safe-area-inset-bottom)] md:pb-0",
            "transition duration-150 data-closed:opacity-0",
            "data-closed:translate-y-2 md:data-closed:scale-95 md:data-closed:translate-y-0",
            "motion-reduce:transition-none motion-reduce:data-closed:translate-y-0",
          )}
        >
          <Combobox
            /*
             * `value={null}` keeps this a pure action picker: nothing stays
             * selected, so choosing the same result twice fires twice. A
             * controlled selection would silently swallow the second Enter.
             */
            value={null}
            onChange={(itemId: string | null) => {
              if (itemId !== null) onSelect(itemId);
            }}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-4">
              <Search
                className="size-icon-md shrink-0 text-ink-400"
                strokeWidth={1.75}
                aria-hidden
              />

              <ComboboxInput
                autoFocus
                aria-label={label}
                placeholder={placeholder}
                value={query}
                onChange={(event) => {
                  onQueryChange(event.target.value);
                }}
                /*
                 * Escape has to be handled here. The `Combobox` treats it as
                 * "close the option list" and stops it there — which does
                 * nothing visible when the options are `static`, so the key
                 * appeared dead and the palette could only be dismissed by
                 * clicking the backdrop.
                 */
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onClose();
                  }
                }}
                className={cn(
                  "h-12 w-full border-0 bg-transparent text-sm text-ink-900",
                  "placeholder:text-ink-400 focus:outline-none",
                )}
              />

              {isSearching && <Spinner size="xs" className="text-ink-400" />}
            </div>

            {/*
              `static` because the Dialog already controls visibility. Letting
              the Combobox manage its own open state too gives two sources of
              truth for one panel.
            */}
            <ComboboxOptions
              static
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
            >
              {!hasQuery && hintLabel !== undefined && (
                <p className="px-2 py-6 text-center text-xs text-ink-400">
                  {hintLabel}
                </p>
              )}

              {hasQuery && total === 0 && !isSearching && (
                <p className="px-2 py-6 text-center text-xs text-ink-400">
                  {emptyLabel}
                </p>
              )}

              {groups.map((group) => (
                <div key={group.id} className="mb-1 last:mb-0">
                  {/*
                    A plain heading, not a `role="group"` label: the Combobox
                    owns the listbox semantics, and nesting groups inside it
                    would need `ComboboxOptions` support that does not exist.
                    The heading is `aria-hidden` so the option's own label
                    carries the list name instead.
                  */}
                  <p
                    aria-hidden
                    className="px-2 py-1 text-xs font-medium text-ink-400"
                  >
                    {group.label}
                  </p>

                  {group.items.map((item) => (
                    <ComboboxOption
                      key={item.id}
                      value={item.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md px-2",
                        // 2.75rem on touch; denser only where a fine pointer
                        // makes it usable (Requirement 20.9).
                        "min-h-11 can-hover:min-h-9",
                        "data-focus:bg-surface-hover",
                      )}
                    >
                      {item.icon && (
                        <item.icon
                          className="size-icon-md shrink-0 text-ink-400"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      )}

                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-ink-900">
                          {item.label}
                        </span>

                        {item.description !== undefined && (
                          <span className="truncate text-xs text-ink-400">
                            {item.description}
                          </span>
                        )}
                      </span>

                      {item.meta !== undefined && (
                        <span className="shrink-0">{item.meta}</span>
                      )}
                    </ComboboxOption>
                  ))}
                </div>
              ))}
            </ComboboxOptions>
          </Combobox>

          {footer !== undefined && (
            <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2">
              {footer}
            </div>
          )}
        </DialogPanel>
      </div>
    </HeadlessDialog>
  );
}

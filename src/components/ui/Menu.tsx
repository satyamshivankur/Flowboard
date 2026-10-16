import {
  Menu as HeadlessMenu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import type { LucideIcon } from "lucide-react";
import { Fragment, useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Optional props spell out `| undefined` throughout the design system.
 * `exactOptionalPropertyTypes` is on — which is what we want in the Model,
 * where an absent field and an explicit `undefined` genuinely differ — but for
 * component props a caller passing `undefined` to mean "not set" is ordinary
 * React, and forcing conditional spreads at every call site buys nothing.
 */
export interface MenuItemSpec {
  readonly id: string;
  readonly label: string;
  readonly icon?: LucideIcon | undefined;
  readonly tone?: "default" | "danger" | undefined;
  readonly disabled?: boolean | undefined;
  /** Shown when disabled, so a greyed item explains itself (Req 8.11). */
  readonly disabledReason?: string | undefined;
  readonly onSelect: () => void;
  readonly separatorBefore?: boolean | undefined;
}

export interface MenuProps {
  readonly trigger: ReactNode;
  readonly items: readonly MenuItemSpec[];
  readonly align?: "start" | "end" | undefined;
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}

const TONE: Record<NonNullable<MenuItemSpec["tone"]>, string> = {
  default: "text-ink-900 data-focus:bg-surface-hover",
  danger: "text-danger-600 data-focus:bg-danger-50",
};

/**
 * A dropdown menu.
 *
 * Headless UI handles roving focus, typeahead, Escape and click-outside. The
 * panel is width-constrained in rem and its items grow to the touch minimum on
 * coarse pointers, since a dense 2rem row is not tappable (Requirement 20.9).
 */
export function Menu({
  trigger,
  items,
  align = "end",
  label,
  className,
}: MenuProps) {
  const reasonPrefix = useId();

  return (
    <HeadlessMenu as="div" className="relative inline-flex">
      {/*
        `as={Fragment}` merges the menu's props onto the trigger element itself.
        Rendering a wrapper instead — `as="div"` — nests the caller's `<button>`
        inside a `role="button"` div, which is invalid interactive nesting and
        puts the accessible name on the wrapper rather than on the control the
        user actually focuses.
      */}
      <MenuButton as={Fragment} aria-label={label}>
        {trigger}
      </MenuButton>

      <MenuItems
        transition
        anchor={{ to: align === "end" ? "bottom end" : "bottom start", gap: 4 }}
        className={cn(
          "z-50 min-w-48 rounded-lg bg-surface p-1 shadow-popover ring-1 ring-border",
          // 150ms, the shared floor: below about 120ms a transition reads as a
          // flicker rather than as motion (Requirement 14.11).
          "transition duration-150 data-closed:scale-95 data-closed:opacity-0",
          "motion-reduce:transition-none motion-reduce:data-closed:scale-100",
          "focus:outline-none",
          className,
        )}
      >
        {items.map((item) => {
          const showReason =
            item.disabled === true && item.disabledReason !== undefined;
          const reasonId = `${reasonPrefix}-${item.id}`;

          return (
          <div key={item.id}>
            {item.separatorBefore === true && (
              <div className="my-1 h-px bg-border" role="separator" />
            )}

            <MenuItem>
              <button
                type="button"
                disabled={item.disabled === true}
                title={item.disabled === true ? item.disabledReason : undefined}
                /*
                 * The accessible name is the label and nothing else; the
                 * reason is a *description*. Left as plain text inside the
                 * button it would become part of the name — and only on a
                 * coarse pointer, so the same item would be called two
                 * different things on two devices.
                 */
                aria-label={item.label}
                aria-describedby={showReason ? reasonId : undefined}
                onClick={item.onSelect}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2.5 text-left text-sm",
                  // `min-h` rather than a fixed height: a disabled item grows
                  // to fit the reason it now states inline.
                  "min-h-8 py-1 coarse-pointer:min-h-touch",
                  "transition-colors motion-reduce:transition-none",
                  "disabled:pointer-events-none disabled:opacity-40",
                  TONE[item.tone ?? "default"],
                )}
              >
                {item.icon && (
                  <item.icon
                    className="size-icon-md shrink-0"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>

                  {/*
                    The reason a control is disabled cannot live only in
                    `title`: a touch device has no hover, so the explanation
                    would be unreachable exactly where the user cannot guess it
                    (Requirement 8.11, 17.2, 20.10). `title` still serves a
                    mouse; this serves everything else.
                  */}
                  {showReason && (
                    <span
                      id={reasonId}
                      className="hidden truncate text-xs font-normal text-ink-400 coarse-pointer:block"
                    >
                      {item.disabledReason}
                    </span>
                  )}
                </span>
              </button>
            </MenuItem>
          </div>
          );
        })}
      </MenuItems>
    </HeadlessMenu>
  );
}

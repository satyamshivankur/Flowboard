import {
  Menu as HeadlessMenu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface MenuItemSpec {
  readonly id: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly tone?: "default" | "danger";
  readonly disabled?: boolean;
  /** Shown when disabled, so a greyed item explains itself (Req 8.11). */
  readonly disabledReason?: string;
  readonly onSelect: () => void;
  readonly separatorBefore?: boolean;
}

export interface MenuProps {
  readonly trigger: ReactNode;
  readonly items: readonly MenuItemSpec[];
  readonly align?: "start" | "end";
  readonly label?: string;
  readonly className?: string;
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
  return (
    <HeadlessMenu as="div" className="relative inline-flex">
      <MenuButton as="div" aria-label={label}>
        {trigger}
      </MenuButton>

      <MenuItems
        transition
        anchor={{ to: align === "end" ? "bottom end" : "bottom start", gap: 4 }}
        className={cn(
          "z-50 min-w-48 rounded-lg bg-surface p-1 shadow-popover ring-1 ring-border",
          "transition duration-100 data-closed:scale-95 data-closed:opacity-0",
          "motion-reduce:transition-none motion-reduce:data-closed:scale-100",
          "focus:outline-none",
          className,
        )}
      >
        {items.map((item) => (
          <div key={item.id}>
            {item.separatorBefore === true && (
              <div className="my-1 h-px bg-border" role="separator" />
            )}

            <MenuItem>
              <button
                type="button"
                disabled={item.disabled === true}
                title={item.disabled === true ? item.disabledReason : undefined}
                onClick={item.onSelect}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2.5 text-left text-sm",
                  "h-8 coarse-pointer:min-h-touch",
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
                <span className="truncate">{item.label}</span>
              </button>
            </MenuItem>
          </div>
        ))}
      </MenuItems>
    </HeadlessMenu>
  );
}

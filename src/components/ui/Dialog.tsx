import {
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from "@headlessui/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useLatched } from "@/lib/useLatched";

import { IconButton } from "./IconButton";

export type DialogSize = "sm" | "md" | "lg";

export interface DialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly size?: DialogSize;
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
}

/*
 * Widths in rem via the `max-w-*` scale, which is rem-based by default.
 * Full-width below `sm` so a dialog never overflows a phone.
 */
const SIZE: Record<DialogSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

/**
 * A modal dialog.
 *
 * Headless UI supplies focus trapping, Escape handling, focus restoration to
 * the trigger, scroll locking and `aria-modal` wiring. Re-implementing any of
 * that by hand is how focus bugs get shipped (Requirement 17.2).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  children,
  className,
}: DialogProps) {
  /*
   * Content is latched to what it was while open, so the leave transition plays
   * out against the dialog the user was actually looking at.
   *
   * The symptom this fixes is visible in `ConfirmHost`, which renders
   * `pending?.title ?? ""`: resolving the confirmation nulls `pending` in the
   * same commit that starts the close, so the dialog emptied itself for the
   * 150ms it spent fading out.
   */
  const exitTitle = useLatched(title, open);
  const exitDescription = useLatched(description, open);
  const exitSize = useLatched(size, open);
  const exitFooter = useLatched(footer, open);
  const exitChildren = useLatched(children, open);

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

      <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center">
        <DialogPanel
          transition
          className={cn(
            "w-full rounded-xl bg-surface shadow-overlay",
            "transition duration-150 data-closed:translate-y-2 data-closed:opacity-0",
            "motion-reduce:transition-none motion-reduce:data-closed:translate-y-0",
            SIZE[exitSize],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-4">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-sm font-semibold text-ink-900">
                {exitTitle}
              </DialogTitle>

              {exitDescription !== undefined && (
                <Description className="text-sm text-ink-600">
                  {exitDescription}
                </Description>
              )}
            </div>

            <IconButton
              icon={X}
              label="Close"
              size="sm"
              onClick={onClose}
              tooltip={false}
            />
          </div>

          {exitChildren !== undefined && (
            <div className="px-5 py-4">{exitChildren}</div>
          )}

          {exitFooter !== undefined && (
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              {exitFooter}
            </div>
          )}
        </DialogPanel>
      </div>
    </HeadlessDialog>
  );
}

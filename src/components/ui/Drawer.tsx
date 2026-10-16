import {
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
} from "@headlessui/react";
import type { ReactNode, RefObject } from "react";

import { cn } from "@/lib/cn";
import { useLatched } from "@/lib/useLatched";

export type DrawerSide = "right" | "bottom" | "left";

export interface DrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /**
   * Which edge the panel attaches to.
   *
   * `"right"` is the desktop task drawer, `"bottom"` the mobile sheet, `"left"`
   * the off-canvas navigation. One component serves all three, because the
   * difference is positioning rather than behaviour (Requirement 20.7).
   */
  readonly side?: DrawerSide;
  /** Accessible name, since the drawer has no visible `DialogTitle` of its own. */
  readonly label: string;
  readonly widthClassName?: string;
  readonly initialFocus?: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
  readonly className?: string;
}

/*
 * Mobile-first: unprefixed classes describe the sheet, `md:` promotes it to a
 * side panel. No `max-*` variants — the small layout is the baseline.
 */
const SIDE: Record<DrawerSide, string> = {
  right:
    "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:rounded-none md:rounded-l-xl",
  bottom: "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl",
  left: "inset-y-0 left-0 max-w-[85vw] rounded-r-xl",
};

const CLOSED: Record<DrawerSide, string> = {
  right:
    "data-closed:translate-y-full md:data-closed:translate-x-full md:data-closed:translate-y-0",
  bottom: "data-closed:translate-y-full",
  left: "data-closed:-translate-x-full",
};

export function Drawer({
  open,
  onClose,
  side = "right",
  label,
  widthClassName,
  initialFocus,
  children,
  className,
}: DrawerProps) {
  /*
   * Everything that affects how the panel *looks on the way out* is latched to
   * the value it had while open. Without this, a caller that derives `open`
   * from the same state as `side` — the natural way to write it — collapses
   * `side` to its default in the same commit that starts the close, and the
   * panel animates out towards the wrong edge.
   */
  const exitSide = useLatched(side, open);
  const exitWidth = useLatched(widthClassName, open);
  const exitLabel = useLatched(label, open);
  const exitChildren = useLatched(children, open);

  return (
    <HeadlessDialog
      open={open}
      onClose={onClose}
      className="relative z-40"
      aria-label={exitLabel}
      {...(initialFocus ? { initialFocus } : {})}
    >
      <DialogBackdrop
        transition
        className={cn(
          "fixed inset-0 bg-ink-900/40",
          "transition-opacity duration-200 data-closed:opacity-0",
          "motion-reduce:transition-none",
        )}
      />

      <DialogPanel
        transition
        className={cn(
          "fixed flex flex-col bg-surface shadow-overlay",
          // `dvh` rather than `vh`: mobile browser chrome overlaps a vh-sized
          // panel, putting its footer under the URL bar (Requirement 20.13).
          "transition-transform duration-200 motion-reduce:transition-none",
          // Safe-area padding so a bottom sheet clears the home indicator.
          "pb-[env(safe-area-inset-bottom)]",
          SIDE[exitSide],
          CLOSED[exitSide],
          exitWidth,
          className,
        )}
      >
        {exitChildren}
      </DialogPanel>
    </HeadlessDialog>
  );
}

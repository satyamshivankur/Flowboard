import {
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
} from "@headlessui/react";
import {
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

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

/**
 * How far the sheet must be dragged down before release dismisses it.
 *
 * px-exception: a pointer-travel threshold measured against `clientY`, which
 * the browser reports in CSS pixels. It is not a rendered dimension, so there
 * is no `rem` equivalent to express it in (Requirement 22.4, 22.5).
 */
const DISMISS_THRESHOLD_PX = 96;

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

  /*
   * Drag-to-dismiss, for the sheet form only.
   *
   * The handle carries `md:hidden`, so above `md` it is not in the layout and
   * these handlers can never fire — the gesture is gated by the same CSS that
   * decides sheet versus panel, with no viewport check in JavaScript
   * (Requirement 20.7).
   */
  const dragOrigin = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const isSheet = exitSide === "bottom" || exitSide === "right";

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragOrigin.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const origin = dragOrigin.current;

    if (origin === null) return;

    // Downward only. Dragging a bottom sheet upward should do nothing rather
    // than detach it from the edge it is anchored to.
    setDragOffset(Math.max(0, event.clientY - origin));
  }

  function handlePointerUp() {
    const travelled = dragOffset;

    dragOrigin.current = null;
    setDragOffset(0);

    if (travelled >= DISMISS_THRESHOLD_PX) onClose();
  }

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
        /*
         * The live drag offset — one of the three documented inline-`style`
         * exceptions, alongside the sidebar resizer width and tooltip
         * coordinates. A per-pointer-event value cannot be a utility class
         * (Requirement 13.4).
         */
        style={
          dragOffset > 0
            ? { transform: `translateY(${String(dragOffset / 16)}rem)` }
            : undefined
        }
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
          // The panel must not animate back while a finger is still on it.
          dragOffset > 0 && "transition-none",
          className,
        )}
      >
        {isSheet && (
          /*
           * The grab handle: a pointer affordance only, and deliberately not
           * focusable. Escape and the caller's own close control already serve
           * the keyboard, so adding a third close target would only clutter
           * the tab order — and it would take initial focus, since Headless UI
           * focuses the first focusable element in the panel.
           *
           * `touch-none` stops the browser treating the gesture as a scroll
           * before the handler sees it.
           */
          <div
            aria-hidden
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="flex shrink-0 cursor-grab touch-none justify-center py-2 md:hidden"
          >
            <span className="h-1 w-10 rounded-full bg-border" />
          </div>
        )}

        {exitChildren}
      </DialogPanel>
    </HeadlessDialog>
  );
}

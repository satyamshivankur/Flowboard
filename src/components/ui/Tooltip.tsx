import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  readonly content: ReactNode;
  readonly side?: TooltipSide;
  /*
   * The `| undefined` is required by `exactOptionalPropertyTypes`: cloning with
   * `aria-describedby: undefined` to clear it is only assignable if the target
   * prop admits undefined explicitly.
   */
  readonly children: ReactElement<{
    "aria-describedby"?: string | undefined;
    onFocus?: (() => void) | undefined;
    onBlur?: (() => void) | undefined;
  }>;
  readonly className?: string;
}

const SIDE: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

/**
 * A hover/focus tooltip.
 *
 * Deliberately **not** rendered on coarse pointers. A tooltip there either
 * never fires, or fires on tap and swallows the tap that was meant to activate
 * the control — so the label has to be reachable another way, which is why
 * `IconButton` carries a required `label` rather than relying on this
 * (Requirement 20.10).
 *
 * The wrapper is `contents`, so adding a tooltip never changes the layout of
 * the element it wraps.
 */
export function Tooltip({
  content,
  side = "top",
  children,
  className,
}: TooltipProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  if (!isValidElement(children)) return children;

  return (
    <span
      className="contents"
      onPointerEnter={() => {
        setVisible(true);
      }}
      onPointerLeave={() => {
        setVisible(false);
      }}
    >
      <span className="relative inline-flex">
        {cloneElement(children, {
          "aria-describedby": visible ? id : undefined,
          onFocus: () => {
            setVisible(true);
          },
          onBlur: () => {
            setVisible(false);
          },
        })}

        <span
          id={id}
          role="tooltip"
          hidden={!visible}
          className={cn(
            // `hidden:` keeps it out of the a11y tree when not shown, and the
            // can-hover gate means it never renders on touch at all.
            "pointer-events-none absolute z-50 hidden whitespace-nowrap",
            "rounded-md bg-ink-900 px-2 py-1 text-xs font-medium text-white shadow-popover",
            "can-hover:block",
            visible ? "" : "invisible",
            SIDE[side],
            className,
          )}
        >
          {content}
        </span>
      </span>
    </span>
  );
}

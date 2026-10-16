import { cn } from "@/lib/cn";

export interface SeparatorProps {
  readonly orientation?: "horizontal" | "vertical";
  readonly spacing?: "none" | "sm" | "md";
  readonly className?: string;
}

const SPACING: Record<NonNullable<SeparatorProps["spacing"]>, string> = {
  none: "",
  sm: "my-1.5",
  md: "my-3",
};

const VERTICAL_SPACING: Record<NonNullable<SeparatorProps["spacing"]>, string> = {
  none: "",
  sm: "mx-1.5",
  md: "mx-3",
};

export function Separator({
  orientation = "horizontal",
  spacing = "none",
  className,
}: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal"
          ? cn("h-px w-full", SPACING[spacing])
          : cn("h-full w-px", VERTICAL_SPACING[spacing]),
        className,
      )}
    />
  );
}

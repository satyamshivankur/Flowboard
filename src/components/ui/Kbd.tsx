import { cn } from "@/lib/cn";

export interface KbdProps {
  readonly keys: readonly string[];
  readonly className?: string;
}

/**
 * Keyboard shortcut hint.
 *
 * Each key is its own `<kbd>` inside a wrapping one, which is the semantic
 * HTML for a chord rather than a single keystroke.
 */
export function Kbd({ keys, className }: KbdProps) {
  return (
    <kbd className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key) => (
        <kbd
          key={key}
          className={cn(
            "inline-flex min-w-4 items-center justify-center rounded px-1",
            "bg-surface-sunken font-mono text-[0.625rem] font-medium text-ink-600",
            "ring-1 ring-inset ring-border",
          )}
        >
          {key}
        </kbd>
      ))}
    </kbd>
  );
}

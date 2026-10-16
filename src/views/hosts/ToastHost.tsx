import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/cn";

/**
 * The visual toast stack.
 *
 * Mounted once in the shell. Lives in the View layer rather than the design
 * system because it reads Context — keeping `Toast` itself props-only means it
 * can be reviewed in Storybook without a provider (Requirement 11.4).
 *
 * The announcement live region is in `ToastProvider`, not here, so
 * screen-reader output does not depend on this component being mounted
 * (Requirement 17.6).
 *
 * Bottom-anchored on mobile where the thumb is, top-right from `sm` where the
 * eye already looks for system notifications.
 */
export function ToastHost() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-50 flex flex-col gap-2",
        "inset-x-4 bottom-4 pb-[env(safe-area-inset-bottom)]",
        "sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto sm:w-80 sm:pb-0",
      )}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          tone={toast.tone}
          title={toast.title}
          {...(toast.description === undefined
            ? {}
            : { description: toast.description })}
          {...(toast.action === undefined ? {} : { action: toast.action })}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}

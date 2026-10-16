import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useConfirm } from "@/contexts/ConfirmContext";

/**
 * Renders whatever `ConfirmContext` currently has pending.
 *
 * Mounted once in the shell. Keeping the dialog state in the context and the
 * markup here is what lets a destructive flow read as a single `await` at the
 * call site while still being a real modal (Requirement 14.9).
 */
export function ConfirmHost() {
  const { pending, resolvePending } = useConfirm();

  return (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.title ?? ""}
      {...(pending?.body === undefined ? {} : { body: pending.body })}
      {...(pending?.confirmLabel === undefined
        ? {}
        : { confirmLabel: pending.confirmLabel })}
      {...(pending?.cancelLabel === undefined
        ? {}
        : { cancelLabel: pending.cancelLabel })}
      tone={pending?.tone ?? "default"}
      onConfirm={() => {
        resolvePending(true);
      }}
      onCancel={() => {
        resolvePending(false);
      }}
    />
  );
}

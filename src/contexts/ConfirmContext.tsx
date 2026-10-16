import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { createSafeContext } from "./createSafeContext";

/**
 * Promise-based confirmation.
 *
 * Exposing a promise is what keeps a destructive flow readable at the call
 * site, instead of splitting it across an `onConfirm` callback and a piece of
 * component state:
 *
 *   if (!(await confirm({ title: 'Archive "Sprint 14"?' }))) return;
 *   await archive(listId);
 *
 * This provider owns only the *state* of a pending request. The dialog that
 * renders it is a design-system component, added in Phase 4 — so the
 * behavioural contract exists and is testable before any styling does
 * (Requirement 14.9).
 */

export interface ConfirmOptions {
  readonly title: string;
  readonly body?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: "danger" | "default";
}

export interface PendingConfirm extends ConfirmOptions {
  readonly id: string;
  readonly resolve: (confirmed: boolean) => void;
}

export interface ConfirmContextValue {
  readonly pending: PendingConfirm | null;
  readonly confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Called by the dialog host. */
  readonly resolvePending: (confirmed: boolean) => void;
}

const { Provider, useValue } = createSafeContext<ConfirmContextValue>("Confirm");

export const useConfirm = useValue;

let sequence = 0;

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    /*
     * A second request while one is open resolves the first as cancelled rather
     * than queueing. Two stacked confirmations would leave the user approving
     * something they can no longer see the context for.
     */
    pendingRef.current?.resolve(false);

    sequence += 1;

    return new Promise<boolean>((resolve) => {
      const request: PendingConfirm = {
        ...options,
        id: `confirm-${String(sequence)}`,
        resolve,
      };

      pendingRef.current = request;
      setPending(request);
    });
  }, []);

  const resolvePending = useCallback((confirmed: boolean) => {
    pendingRef.current?.resolve(confirmed);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const value = useMemo(
    () => ({ pending, confirm, resolvePending }),
    [pending, confirm, resolvePending],
  );

  return <Provider value={value}>{children}</Provider>;
}

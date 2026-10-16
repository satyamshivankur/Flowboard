import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { TOAST_DURATION_MS } from "@/config/limits";
import type { AppError } from "@/model/result";

import { createSafeContext } from "./createSafeContext";

/**
 * Notifications.
 *
 * Every failed mutation surfaces here, which is what keeps error handling in
 * one place instead of each component inventing its own
 * (Requirement 14.4, 14.6).
 */

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface Toast {
  readonly id: string;
  readonly tone: ToastTone;
  readonly title: string;
  readonly description?: string;
  readonly action?: ToastAction;
  /** Milliseconds before auto-dismiss. `null` keeps it until dismissed. */
  readonly duration: number | null;
}

export interface ToastInput {
  readonly tone: ToastTone;
  readonly title: string;
  readonly description?: string;
  readonly action?: ToastAction;
  readonly duration?: number | null;
}

export interface ToastContextValue {
  readonly toasts: readonly Toast[];
  readonly push: (input: ToastInput) => string;
  readonly dismiss: (id: string) => void;
  readonly dismissAll: () => void;
  /** Surfaces an `AppError` with wording appropriate to its code. */
  readonly pushError: (error: AppError, options?: { retry?: () => void }) => string;
  readonly pushSuccess: (title: string, description?: string) => string;
}

const { Provider, useValue } = createSafeContext<ToastContextValue>("Toast");

export const useToast = useValue;

/**
 * Titles per error code.
 *
 * Permission denials and network failures read differently on purpose: one is
 * a dead end, the other is worth retrying, and a single "Something went wrong"
 * makes both useless (Requirement 14.5).
 */
const ERROR_TITLES: Record<AppError["code"], string> = {
  FORBIDDEN: "Not allowed",
  NETWORK: "Connection problem",
  VALIDATION: "Check that again",
  NOT_FOUND: "No longer available",
  CONFLICT: "Can't do that right now",
};

let sequence = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);

    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput): string => {
      sequence += 1;
      const id = `toast-${String(sequence)}`;

      const toast: Toast = {
        id,
        tone: input.tone,
        title: input.title,
        duration: input.duration === undefined ? TOAST_DURATION_MS : input.duration,
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.action === undefined ? {} : { action: input.action }),
      };

      setToasts((current) => [...current, toast]);

      if (toast.duration !== null) {
        timers.current.set(
          id,
          setTimeout(() => {
            dismiss(id);
          }, toast.duration),
        );
      }

      return id;
    },
    [dismiss],
  );

  const dismissAll = useCallback(() => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    setToasts([]);
  }, []);

  const pushError = useCallback(
    (error: AppError, options: { retry?: () => void } = {}): string => {
      /*
       * A retry action is offered only when the error says it is safe to
       * retry. Offering "Try again" on a permission denial invites the user to
       * hammer a button that cannot ever succeed.
       */
      const canRetry = error.retryable === true && options.retry !== undefined;

      return push({
        tone: error.code === "FORBIDDEN" ? "warning" : "error",
        title: ERROR_TITLES[error.code],
        description: error.message,
        ...(canRetry && options.retry
          ? { action: { label: "Try again", onClick: options.retry } }
          : {}),
      });
    },
    [push],
  );

  const pushSuccess = useCallback(
    (title: string, description?: string): string =>
      push({
        tone: "success",
        title,
        ...(description === undefined ? {} : { description }),
      }),
    [push],
  );

  const value = useMemo(
    () => ({ toasts, push, dismiss, dismissAll, pushError, pushSuccess }),
    [toasts, push, dismiss, dismissAll, pushError, pushSuccess],
  );

  return (
    <Provider value={value}>
      {children}
      {/*
        The announcement region lives here rather than in the visual toast host,
        so screen-reader output does not depend on a styled component existing
        (Requirement 17.6).
      */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {toasts.map((toast) => (
          <div key={toast.id}>
            {toast.title}
            {toast.description === undefined ? "" : `. ${toast.description}`}
          </div>
        ))}
      </div>
    </Provider>
  );
}

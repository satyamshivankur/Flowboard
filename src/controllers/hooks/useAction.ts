import { useCallback, useMemo } from "react";

import { useToast } from "@/contexts/ToastContext";
import type { Result } from "@/model/result";

/**
 * The single error-surfacing path.
 *
 * Wraps a mutation callback so a failed `Result` becomes a toast and nothing
 * else has to remember to handle it. Without this, error handling ends up
 * duplicated at every call site and inconsistent by the third one
 * (Requirement 14.4, 14.5 — task 8.7).
 *
 * The wrapped call still returns the `Result`, so a caller that needs to branch
 * on success — closing a dialog, clearing an input — can, while a caller that
 * does not can ignore it entirely.
 *
 * Note the layering: this is the one Controller module that imports a Context.
 * The edge runs Controller → Context and never back, which the boundary lint
 * enforces.
 */
export interface ActionOptions {
  /** Shown as a success toast. Omit for mutations whose result is obvious. */
  readonly successTitle?: string;
  readonly successDescription?: string;
  /** Allow the toast to offer a retry for retryable failures. */
  readonly retryable?: boolean;
}

export function useAction(): {
  readonly run: <T>(
    operation: () => Promise<Result<T>>,
    options?: ActionOptions,
  ) => Promise<Result<T>>;
} {
  const toast = useToast();

  const run = useCallback(
    <T>(
      operation: () => Promise<Result<T>>,
      options: ActionOptions = {},
    ): Promise<Result<T>> => {
      /*
       * Recursion is local rather than through `run` itself. Referencing the
       * memoized callback from inside its own body reads the binding before it
       * is initialised, so a retry would capture a stale closure — and the
       * React Compiler rejects it outright.
       */
      const attempt = async (): Promise<Result<T>> => {
        const result = await operation();

        if (!result.ok) {
          toast.pushError(
            result.error,
            /*
             * Retry re-runs the same operation. Safe because a mutation is a
             * closure over its inputs rather than something that consumes
             * them, and because a rejected mutation provably left the Model
             * untouched.
             */
            options.retryable === true
              ? {
                  retry: () => {
                    void attempt();
                  },
                }
              : {},
          );

          return result;
        }

        /*
         * Success toasts only where the outcome is not self-evident. An inline
         * title edit that visibly changed does not need confirming, and
         * toasting it turns the feed into noise (Requirement 14.10).
         */
        if (options.successTitle !== undefined) {
          toast.pushSuccess(options.successTitle, options.successDescription);
        }

        return result;
      };

      return attempt();
    },
    [toast],
  );

  return useMemo(() => ({ run }), [run]);
}

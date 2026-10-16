import { useCallback, useMemo, useState } from "react";

import type { Result } from "@/model/result";

import { useAction, type ActionOptions } from "./useAction";

/**
 * `useAction`, plus a record of which things are currently in flight.
 *
 * Pending state belongs at the point of interaction — the card that was
 * clicked, the row that was ticked, the drawer field that was changed — and
 * never as a global overlay, which blocks the whole app to report that one
 * small thing is happening (Requirement 14.7).
 *
 * Keys are caller-chosen: the board keys by task id, the drawer by field name.
 * A `null` key opts out, for mutations whose own control already shows the
 * change — an inline title edit does not need a spinner to confirm the text
 * the user just typed.
 *
 * A set rather than a boolean, because two mutations genuinely overlap: with
 * simulated latency a user can tick one card and drag another before the first
 * resolves, and a single flag would clear on the wrong one.
 */
export interface PendingActionApi {
  readonly isPending: (key: string) => boolean;
  /** True while anything at all is in flight, for a coarse container hint. */
  readonly hasPending: boolean;
  readonly run: <T>(
    key: string | null,
    operation: () => Promise<Result<T>>,
    options?: ActionOptions,
  ) => Promise<Result<T>>;
}

export function usePendingAction(): PendingActionApi {
  const { run: runAction } = useAction();
  const [pending, setPending] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const release = useCallback((key: string) => {
    setPending((current) => {
      if (!current.has(key)) return current;

      const next = new Set(current);

      next.delete(key);

      return next;
    });
  }, []);

  const run = useCallback(
    async <T>(
      key: string | null,
      operation: () => Promise<Result<T>>,
      options?: ActionOptions,
    ): Promise<Result<T>> => {
      if (key === null) return runAction(operation, options);

      setPending((current) => new Set(current).add(key));

      try {
        return await runAction(operation, options);
      } finally {
        /*
         * `finally`, so a thrown operation cannot leave a key stuck pending
         * and the affordance disabled for the rest of the session.
         */
        release(key);
      }
    },
    [runAction, release],
  );

  const isPending = useCallback((key: string) => pending.has(key), [pending]);

  return useMemo(
    () => ({ isPending, hasPending: pending.size > 0, run }),
    [isPending, pending, run],
  );
}

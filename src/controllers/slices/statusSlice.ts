import { requireCapability } from "@/model/permissions";
import { positionForIndex, sortByPosition } from "@/model/position";
import type { AppError, Result } from "@/model/result";
import { findStatus } from "@/model/state";
import type { Scope, Status } from "@/model/types";
import { validateContainerName } from "@/model/validation";

import { runMutation } from "../pipeline";

import type { SliceContext, StatusActions } from "./types";

/**
 * Per-list status operations.
 *
 * The status set is modelled, persisted and enforced, but there is no editor UI
 * in this build — the actions exist and are tested, and the README names the
 * editor as a cut. Keeping them here means the capability
 * (`status:update`, admin-only) is already wired when that UI lands.
 */
export function createStatusSlice(context: SliceContext): StatusActions {
  const pipeline = {
    transport: context.deps.transport,
    getState: context.getState,
    setState: context.setState,
  };

  return {
    rename: (scope: Scope, statusId, name): Promise<Result<Status>> =>
      runMutation(pipeline, {
        validate: (state): AppError | null => {
          const status = findStatus(state, statusId);

          if (!status) {
            return { code: "NOT_FOUND", message: "That status no longer exists." };
          }

          return validateContainerName(name);
        },
        authorize: (state) => {
          const status = findStatus(state, statusId);

          return status
            ? requireCapability(state, scope, "status:update", status.listId)
            : { code: "NOT_FOUND", message: "That status no longer exists." };
        },
        apply: (draft) => {
          const existing = draft.statuses[statusId];

          if (!existing) throw new Error("Status vanished mid-mutation");

          const updated: Status = { ...existing, name: name.trim() };

          draft.statuses[statusId] = updated;

          return updated;
        },
      }),

    reorder: (scope, statusId, toIndex): Promise<Result<Status>> =>
      runMutation(pipeline, {
        validate: (state): AppError | null =>
          findStatus(state, statusId)
            ? null
            : { code: "NOT_FOUND", message: "That status no longer exists." },
        authorize: (state) => {
          const status = findStatus(state, statusId);

          return status
            ? requireCapability(state, scope, "status:update", status.listId)
            : { code: "NOT_FOUND", message: "That status no longer exists." };
        },
        apply: (draft) => {
          const existing = draft.statuses[statusId];

          if (!existing) throw new Error("Status vanished mid-mutation");

          const siblings = sortByPosition(
            Object.values(draft.statuses).filter(
              (candidate) =>
                candidate.listId === existing.listId &&
                candidate.id !== statusId,
            ),
          );

          const updated: Status = {
            ...existing,
            position: positionForIndex(siblings, toIndex),
          };

          draft.statuses[statusId] = updated;

          return updated;
        },
      }),
  };
}

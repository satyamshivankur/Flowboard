import { nanoid } from "nanoid";

import { CONTAINER_REGISTRY } from "@/config/containers";
import { childContainers, descendantContainers } from "@/model/hierarchy";
import { requireCapability } from "@/model/permissions";
import { positionForIndex, sortByPosition } from "@/model/position";
import type { AppError, Result } from "@/model/result";
import { findContainer, type MutableFlowboardState } from "@/model/state";
import type { Container, Scope } from "@/model/types";
import {
  validateContainerMove,
  validateContainerName,
  validateParentType,
} from "@/model/validation";

import { firstError, runMutation } from "../pipeline";

import type { ContainerActions, SliceContext } from "./types";

/**
 * Container CRUD, reordering and archiving.
 *
 * Every action here is admin-only in the default capability table, which is
 * what makes the Alice-vs-Bob difference visible in the sidebar's context
 * menus as well as in the tree (Requirement 8.9).
 */
export function createContainerSlice(context: SliceContext): ContainerActions {
  const pipeline = {
    transport: context.deps.transport,
    getState: context.getState,
    setState: context.setState,
  };

  /** Archives or restores a subtree in one pass, returning the ids touched. */
  function setArchivedAt(
    draft: MutableFlowboardState,
    rootId: string,
    archivedAt: string | null,
  ): string[] {
    const root = draft.containers[rootId];

    if (!root) return [];

    /*
     * `descendantContainers` is given `includeArchived: true` deliberately.
     * When archiving, nothing below is archived yet so it makes no difference;
     * when restoring, the descendants ARE archived and would otherwise be
     * invisible to the traversal, leaving them orphaned in an archived state
     * under a live parent.
     */
    const subtree = descendantContainers(
      { ...context.getState(), containers: draft.containers },
      rootId,
      { includeArchived: true },
    );

    const touched = [root, ...subtree];
    const now = new Date().toISOString();

    for (const node of touched) {
      draft.containers[node.id] = {
        ...node,
        archivedAt,
        updatedAt: now,
      };
    }

    return touched.map((node) => node.id);
  }

  return {
    create: (scope: Scope, input): Promise<Result<Container>> =>
      runMutation(pipeline, {
        validate: (state): AppError | null => {
          const parent = findContainer(state, input.parentId);

          if (!parent) {
            return {
              code: "NOT_FOUND",
              message: "The parent no longer exists.",
            };
          }

          return firstError(
            validateContainerName(input.name),
            validateParentType(parent.type, input.type),
          );
        },
        authorize: (state) =>
          requireCapability(state, scope, "container:create", input.parentId),
        apply: (draft) => {
          const siblings = sortByPosition(
            Object.values(draft.containers).filter(
              (candidate) =>
                candidate.parentId === input.parentId &&
                candidate.archivedAt === null,
            ),
          );

          const now = new Date().toISOString();

          const created: Container = {
            id: `${input.type.slice(0, 2)}-${nanoid(8)}`,
            workspaceId: scope.workspaceId,
            name: input.name.trim(),
            type: input.type,
            parentId: input.parentId,
            position: positionForIndex(siblings, siblings.length),
            visibility: input.visibility ?? "public",
            archivedAt: null,
            createdAt: now,
            updatedAt: now,
          };

          draft.containers[created.id] = created;

          return created;
        },
      }),

    rename: (scope, containerId, name): Promise<Result<Container>> =>
      runMutation(pipeline, {
        validate: (state): AppError | null => {
          const container = findContainer(state, containerId);

          if (!container) {
            return {
              code: "NOT_FOUND",
              message: "That item no longer exists.",
            };
          }

          if (CONTAINER_REGISTRY[container.type].mutable === false) {
            return {
              code: "VALIDATION",
              message: `A ${CONTAINER_REGISTRY[container.type].label.toLowerCase()} cannot be renamed.`,
            };
          }

          return validateContainerName(name);
        },
        authorize: (state) =>
          requireCapability(state, scope, "container:update", containerId),
        apply: (draft) => {
          const existing = draft.containers[containerId];

          if (!existing) throw new Error("Container vanished mid-mutation");

          const updated: Container = {
            ...existing,
            name: name.trim(),
            updatedAt: new Date().toISOString(),
          };

          draft.containers[containerId] = updated;

          return updated;
        },
      }),

    /**
     * Soft delete. Cascades down the container subtree; the tasks of an
     * archived list become unreachable because every task selector resolves
     * through its list, so nothing is physically removed and `unarchive`
     * restores the subtree exactly (Requirement 1.5, 1.6).
     */
    archive: (scope, containerId) =>
      runMutation(pipeline, {
        validate: (state): AppError | null => {
          const container = findContainer(state, containerId);

          if (!container) {
            return {
              code: "NOT_FOUND",
              message: "That item no longer exists.",
            };
          }

          if (container.archivedAt !== null) {
            return {
              code: "CONFLICT",
              message: "That item is already archived.",
            };
          }

          if (container.parentId === null) {
            return {
              code: "VALIDATION",
              message: "A workspace cannot be archived.",
            };
          }

          return null;
        },
        authorize: (state) =>
          requireCapability(state, scope, "container:archive", containerId),
        apply: (draft) => ({
          archivedIds: setArchivedAt(
            draft,
            containerId,
            new Date().toISOString(),
          ),
        }),
      }),

    unarchive: (scope, containerId) =>
      runMutation(pipeline, {
        validate: (state): AppError | null => {
          const container = findContainer(state, containerId);

          if (!container) {
            return {
              code: "NOT_FOUND",
              message: "That item no longer exists.",
            };
          }

          if (container.archivedAt === null) {
            return { code: "CONFLICT", message: "That item is not archived." };
          }

          /*
           * Restoring a child under a still-archived parent would produce a
           * live node nobody can reach, since visibility walks the chain.
           */
          const parent =
            container.parentId === null
              ? undefined
              : findContainer(state, container.parentId);

          if (parent && parent.archivedAt !== null) {
            return {
              code: "CONFLICT",
              message: `Restore "${parent.name}" first.`,
            };
          }

          return null;
        },
        authorize: (state) => {
          /*
           * `requireCapability` routes through `canView`, which denies archived
           * nodes to everyone — so an archived node could never be restored.
           * Authorize against the parent instead, which is live by the rule
           * above.
           */
          const container = findContainer(state, containerId);
          const resourceId = container?.parentId ?? containerId;

          return requireCapability(
            state,
            scope,
            "container:archive",
            resourceId,
          );
        },
        apply: (draft) => ({
          restoredIds: setArchivedAt(draft, containerId, null),
        }),
      }),

    reorder: (scope, containerId, toIndex) =>
      runMutation(pipeline, {
        validate: (state): AppError | null =>
          findContainer(state, containerId)
            ? null
            : { code: "NOT_FOUND", message: "That item no longer exists." },
        authorize: (state) =>
          requireCapability(state, scope, "container:reorder", containerId),
        apply: (draft) => {
          const existing = draft.containers[containerId];

          if (!existing || existing.parentId === null) {
            throw new Error("Cannot reorder a root container");
          }

          const siblings = sortByPosition(
            Object.values(draft.containers).filter(
              (candidate) =>
                candidate.parentId === existing.parentId &&
                candidate.archivedAt === null &&
                candidate.id !== containerId,
            ),
          );

          const updated: Container = {
            ...existing,
            position: positionForIndex(siblings, toIndex),
            updatedAt: new Date().toISOString(),
          };

          draft.containers[containerId] = updated;

          return updated;
        },
      }),

    move: (scope, containerId, newParentId, toIndex) =>
      runMutation(pipeline, {
        validate: (state) =>
          validateContainerMove(state, containerId, newParentId),
        authorize: (state) =>
          firstError(
            requireCapability(state, scope, "container:reorder", containerId),
            requireCapability(state, scope, "container:create", newParentId),
          ),
        apply: (draft) => {
          const existing = draft.containers[containerId];

          if (!existing) throw new Error("Container vanished mid-mutation");

          const siblings = sortByPosition(
            Object.values(draft.containers).filter(
              (candidate) =>
                candidate.parentId === newParentId &&
                candidate.archivedAt === null &&
                candidate.id !== containerId,
            ),
          );

          const updated: Container = {
            ...existing,
            parentId: newParentId,
            position: positionForIndex(siblings, toIndex),
            updatedAt: new Date().toISOString(),
          };

          draft.containers[containerId] = updated;

          return updated;
        },
      }),
  };
}

/** Exported for the reorder helpers in tests. */
export { childContainers };

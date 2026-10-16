import { err, ok, type Result } from "@/model/result";
import { createSeedState } from "@/model/seed";
import { findUser } from "@/model/state";
import type { User } from "@/model/types";

import type { SessionActions, SliceContext } from "./types";

/**
 * Session: who the app is acting as, which workspace is scoped, and the two
 * loading flags the shell renders skeletons from.
 *
 * `switchUser` is synchronous on purpose. It changes nothing in the domain —
 * only which user the selectors are evaluated against — so routing it through
 * the transport would add latency to an interaction that has no reason to be
 * slow, and would make the "Alice vs Bob" demo feel broken.
 */
export function createSessionSlice(context: SliceContext): SessionActions {
  return {
    switchUser: (userId: string): Result<User> => {
      const state = context.getState();
      const user = findUser(state, userId);

      if (!user) {
        return err("NOT_FOUND", "That user no longer exists.");
      }

      const isMember = state.memberships.some(
        (membership) =>
          membership.userId === userId &&
          membership.workspaceId === state.activeWorkspaceId,
      );

      if (!isMember) {
        return err(
          "FORBIDDEN",
          `${user.name} is not a member of this workspace.`,
        );
      }

      context.setState((draft) => {
        draft.currentUserId = userId;
      });

      return ok(user);
    },

    setActiveWorkspace: (workspaceId: string): Result<string> => {
      const state = context.getState();

      if (!state.workspaceIds.includes(workspaceId)) {
        return err("NOT_FOUND", "That workspace no longer exists.");
      }

      const isMember = state.memberships.some(
        (membership) =>
          membership.userId === state.currentUserId &&
          membership.workspaceId === workspaceId,
      );

      if (!isMember) {
        return err("FORBIDDEN", "You are not a member of that workspace.");
      }

      context.setState((draft) => {
        draft.activeWorkspaceId = workspaceId;
      });

      return ok(workspaceId);
    },

    hydrate: async (): Promise<void> => {
      context.setState((draft) => {
        draft.isHydrating = true;
      });

      const stored = await context.deps.persistence.load();

      context.setState((draft) => {
        if (stored) {
          draft.activeWorkspaceId = stored.activeWorkspaceId;
          draft.workspaceIds = [...stored.workspaceIds];
          draft.containers = { ...stored.containers };
          draft.tasks = { ...stored.tasks };
          draft.statuses = { ...stored.statuses };
          draft.users = { ...stored.users };
          draft.memberships = [...stored.memberships];
          draft.grants = [...stored.grants];

          /*
           * A stored payload has no notion of who was looking at it. If the
           * persisted current user is no longer a member, fall back to the
           * first member rather than hydrating into an app where every
           * selector returns nothing.
           */
          const stillAMember = stored.memberships.some(
            (membership) =>
              membership.userId === draft.currentUserId &&
              membership.workspaceId === stored.activeWorkspaceId,
          );

          if (!stillAMember) {
            draft.currentUserId =
              stored.memberships.find(
                (membership) =>
                  membership.workspaceId === stored.activeWorkspaceId,
              )?.userId ?? "";
          }
        }

        draft.isHydrating = false;
      });
    },

    resetToSeed: async (): Promise<void> => {
      const seed = createSeedState();

      await context.deps.persistence.clear();

      context.setState((draft) => {
        draft.activeWorkspaceId = seed.activeWorkspaceId;
        draft.workspaceIds = [...seed.workspaceIds];
        draft.containers = { ...seed.containers };
        draft.tasks = { ...seed.tasks };
        draft.statuses = { ...seed.statuses };
        draft.users = { ...seed.users };
        draft.memberships = [...seed.memberships];
        draft.grants = [...seed.grants];
        draft.currentUserId =
          seed.memberships.find(
            (membership) => membership.role === "admin",
          )?.userId ?? "";
        draft.loadingListId = null;
        draft.isHydrating = false;
      });
    },

    /**
     * Marks a list as loading and clears the flag once the transport settles,
     * so switching lists shows a content skeleton rather than snapping
     * instantly from one board to another (Requirement 14.2).
     */
    beginListLoad: async (listId: string): Promise<void> => {
      context.setState((draft) => {
        draft.loadingListId = listId;
      });

      await context.deps.transport.run(() => undefined);

      context.setState((draft) => {
        // Only clear if this is still the list being awaited; a faster second
        // switch must not have its skeleton cancelled by the slower first.
        if (draft.loadingListId === listId) {
          draft.loadingListId = null;
        }
      });
    },
  };
}

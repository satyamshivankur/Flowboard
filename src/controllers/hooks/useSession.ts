import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { ROLE_CONFIG, type Role } from "@/config/capabilities";
import { roleOf } from "@/model/permissions";
import type { Result } from "@/model/result";
import { selectWorkspaceMembers } from "@/model/selectors";
import type { User } from "@/model/types";

import { useStore } from "../store";

import { useScope } from "./useScope";

/** A user as the switcher renders them. */
export interface SessionMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatarToken: User["avatarToken"];
  readonly role: Role;
  readonly roleLabel: string;
  readonly isCurrent: boolean;
}

export interface SessionViewModel {
  readonly currentUser: SessionMember | undefined;
  readonly members: readonly SessionMember[];
  readonly isHydrating: boolean;
  readonly loadingListId: string | null;
  readonly switchUser: (userId: string) => Result<User>;
  readonly resetToSeed: () => Promise<void>;
  readonly hydrate: () => Promise<void>;
}

export function useSession(): SessionViewModel {
  const scope = useScope();

  const isHydrating = useStore((state) => state.isHydrating);
  const loadingListId = useStore((state) => state.loadingListId);
  const actions = useStore((state) => state.actions.session);

  const members = useStore(
    useShallow((state) =>
      selectWorkspaceMembers(state, scope).map((user) => {
        const role = roleOf(state, scope.workspaceId, user.id) ?? "member";

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarToken: user.avatarToken,
          role,
          roleLabel: ROLE_CONFIG[role].label,
          isCurrent: user.id === scope.userId,
        };
      }),
    ),
  );

  const switchUser = useCallback(
    (userId: string) => actions.switchUser(userId),
    [actions],
  );

  return useMemo(
    () => ({
      currentUser: members.find((member) => member.isCurrent),
      members,
      isHydrating,
      loadingListId,
      switchUser,
      resetToSeed: actions.resetToSeed,
      hydrate: actions.hydrate,
    }),
    [members, isHydrating, loadingListId, switchUser, actions],
  );
}

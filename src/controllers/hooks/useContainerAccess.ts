import { useMemo } from "react";

import type { AvatarColorToken } from "@/config/avatars";
import { ROLE_CONFIG, roleBypassesChecks } from "@/config/capabilities";
import { CONTAINER_REGISTRY, type ContainerType } from "@/config/containers";
import {
  defaultAccessFor,
  RESTRICTED_ACCESS,
  type ContainerAccess,
} from "@/model/access";
import { can, canReach } from "@/model/permissions";
import {
  selectContainerAccess,
  selectWorkspaceMemberships,
} from "@/model/selectors";
import { findContainer, type FlowboardState } from "@/model/state";
import type { Scope } from "@/model/types";

import { useStore } from "../store";

import { useScope } from "./useScope";

/**
 * Container access, for the View.
 *
 * Two hooks because there are two moments: the create form has a parent but no
 * container yet, and the manage-access dialog has both. They share one
 * member-shaping function so the same list renders identically in either
 * (Requirement 8.15, 8.16).
 */

/** One row of the access picker. */
export interface AccessMemberViewModel {
  readonly id: string;
  readonly name: string;
  readonly avatarToken: AvatarColorToken;
  readonly roleLabel: string;
  /**
   * True when the role sees everything regardless of this list. Such a row is
   * shown and disabled rather than hidden: an admin missing from a list of
   * "who can see this" reads as an omission, not as a bypass.
   */
  readonly bypasses: boolean;
  /**
   * True when this member cannot reach the container's parent, so granting
   * access here still leaves it unreachable through the tree.
   *
   * Surfaced rather than silently corrected, because the fix is a judgement
   * call — share the parent too, or leave it — and the Controller should not
   * make it (see `canReach`).
   */
  readonly blockedByAncestor: boolean;
}

export interface ContainerAccessViewModel {
  readonly name: string;
  readonly type: ContainerType;
  readonly typeLabel: string;
  /** False for a type the registry says cannot carry a grant. */
  readonly grantable: boolean;
  readonly access: ContainerAccess;
  readonly members: readonly AccessMemberViewModel[];
  readonly canEdit: boolean;
  /** Why editing is unavailable, for a disabled control to explain itself. */
  readonly reason: string | undefined;
}

/**
 * What the dialog reads for an id that no longer resolves.
 *
 * Restricted and uneditable, matching the Model's habit of failing closed: a
 * container archived in another tab must not leave an open dialog offering to
 * publish it.
 */
const MISSING_CONTAINER_ACCESS: ContainerAccessViewModel = {
  name: "",
  type: "list",
  typeLabel: CONTAINER_REGISTRY.list.label,
  grantable: false,
  access: RESTRICTED_ACCESS,
  members: [],
  canEdit: false,
  reason: "That item no longer exists",
};

function buildMembers(
  state: FlowboardState,
  scope: Scope,
  parentId: string | null,
): readonly AccessMemberViewModel[] {
  return selectWorkspaceMemberships(state, scope).map(({ user, role }) => {
    const bypasses = roleBypassesChecks(role);

    return {
      id: user.id,
      name: user.name,
      avatarToken: user.avatarToken,
      roleLabel: ROLE_CONFIG[role].label,
      bypasses,
      blockedByAncestor:
        parentId !== null &&
        !bypasses &&
        !canReach(
          state,
          { workspaceId: scope.workspaceId, userId: user.id },
          parentId,
        ),
    };
  });
}

/**
 * The member rows for a container that does not exist yet.
 *
 * `parentId` is what makes `blockedByAncestor` answerable before creation: a
 * member who cannot reach the parent will not reach the child either, and the
 * create form can say so while the admin is still choosing.
 */
export function useAccessMembers(
  parentId: string | null,
): readonly AccessMemberViewModel[] {
  const scope = useScope();
  const state = useStore();

  return useMemo(
    () => buildMembers(state, scope, parentId),
    [state, scope, parentId],
  );
}

/**
 * Current access for an existing container, plus the rows to edit it with.
 *
 * `containerId` is nullable so the dialog can stay mounted through its close
 * transition without the caller juggling a conditional hook.
 */
export function useContainerAccess(
  containerId: string | null,
): ContainerAccessViewModel {
  const scope = useScope();
  const state = useStore();

  return useMemo(() => {
    const container =
      containerId === null ? undefined : findContainer(state, containerId);

    if (!container) return MISSING_CONTAINER_ACCESS;

    const config = CONTAINER_REGISTRY[container.type];
    const members = buildMembers(state, scope, container.parentId);
    const base = {
      name: container.name,
      type: container.type,
      typeLabel: config.label,
      grantable: config.grantable,
      members,
    };

    if (!config.grantable) {
      return {
        ...base,
        access: defaultAccessFor(container.type),
        canEdit: false,
        reason: `A ${config.label.toLowerCase()}'s access cannot be changed`,
      };
    }

    /*
     * The same question the pipeline will ask on save. Asked here only to
     * disable the control and explain why — enforcement stays in the
     * pipeline, so a stale enabled button still writes nothing
     * (Requirement 8.12).
     */
    const permitted = can(state, scope, "container:share", container.id);

    return {
      ...base,
      access: selectContainerAccess(state, scope, container.id),
      canEdit: permitted,
      ...(permitted ? { reason: undefined } : { reason: "Admins only" }),
    };
  }, [state, scope, containerId]);
}

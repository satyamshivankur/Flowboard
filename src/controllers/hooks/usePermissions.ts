import { useCallback, useMemo } from "react";

import type { Capability } from "@/config/capabilities";
import { can, canView, roleOf } from "@/model/permissions";

import { useStore } from "../store";

import { useScope } from "./useScope";

/**
 * Permission results for the View.
 *
 * Used **only** to disable and hide affordances. Enforcement lives in the
 * selectors and the mutation pipeline, so a View that forgot to check — or a
 * user who found a stale button — still cannot mutate anything they shouldn't
 * (Requirement 8.12).
 */
export interface PermissionsViewModel {
  readonly can: (capability: Capability, resourceId: string) => boolean;
  readonly canView: (nodeId: string) => boolean;
  readonly isAdmin: boolean;
  /** A reason to show on a disabled control, or undefined when permitted. */
  readonly reasonFor: (
    capability: Capability,
    resourceId: string,
  ) => string | undefined;
}

export function usePermissions(): PermissionsViewModel {
  const scope = useScope();
  const state = useStore((current) => current);

  const checkCapability = useCallback(
    (capability: Capability, resourceId: string) =>
      can(state, scope, capability, resourceId),
    [state, scope],
  );

  const checkView = useCallback(
    (nodeId: string) => canView(state, scope, nodeId),
    [state, scope],
  );

  const isAdmin = useMemo(
    () => roleOf(state, scope.workspaceId, scope.userId) === "admin",
    [state, scope],
  );

  const reasonFor = useCallback(
    (capability: Capability, resourceId: string) => {
      if (can(state, scope, capability, resourceId)) return undefined;

      return canView(state, scope, resourceId)
        ? "Admins only"
        : "You don't have access to this item";
    },
    [state, scope],
  );

  return useMemo(
    () => ({ can: checkCapability, canView: checkView, isAdmin, reasonFor }),
    [checkCapability, checkView, isAdmin, reasonFor],
  );
}

import { useMemo } from "react";

import type { Scope } from "@/model/types";

import { useStore } from "../store";

/**
 * The scope every other hook composes.
 *
 * This is the *only* place `activeWorkspaceId` is read. Everything downstream
 * receives the scope as an argument, which is what makes adding a workspace
 * switcher a single `setActiveWorkspace` call rather than a change to thirty
 * call sites (Requirement 21.1, 21.2).
 */
export function useScope(): Scope {
  const workspaceId = useStore((state) => state.activeWorkspaceId);
  const userId = useStore((state) => state.currentUserId);

  return useMemo(() => ({ workspaceId, userId }), [workspaceId, userId]);
}

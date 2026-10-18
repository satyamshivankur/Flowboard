import {
  CAPABILITY_LABELS,
  ROLE_CAPABILITIES,
  roleBypassesChecks,
  roleHasCapability,
  type Capability,
  type Role,
} from "@/config/capabilities";

import { ancestorChain } from "./hierarchy";
import type { AppError } from "./result";
import { findTask, type FlowboardState } from "./state";
import type { Grant, Scope } from "./types";

/**
 * The permission engine.
 *
 * Pure, synchronous, and free of React, Zustand, the browser and any storage
 * mechanism — which is what would let this same module run on a server over a
 * real dataset (Requirement 21.12). It is the only place visibility is decided.
 */

/** An injectable capability table, so tests can add a synthetic role. */
type CapabilityTable = Partial<Record<string, ReadonlySet<Capability>>>;

/**
 * Role, resolved from the user's membership of the workspace being evaluated —
 * never from a field on the user. A user can therefore hold different roles in
 * different workspaces once more than one exists (Requirement 8.6, 21.3).
 */
export function roleOf(
  state: FlowboardState,
  workspaceId: string,
  userId: string,
): Role | null {
  const membership = state.memberships.find(
    (candidate) =>
      candidate.workspaceId === workspaceId && candidate.userId === userId,
  );

  return membership?.role ?? null;
}

/**
 * The subjects a grant may match for this user.
 *
 * Today that is just the user. Team grants widen this to
 * `[userId, ...teamIdsOf(userId)]` and nothing else changes — this function is
 * the whole seam (Requirement 21.8).
 */
export function subjectsOf(_state: FlowboardState, userId: string): string[] {
  return [userId];
}

/**
 * The grant governing `resourceId` for this user, if any.
 *
 * `deny` wins when several grants match the same node. That tie-break is
 * meaningless today — one user matches at most one grant — but it is the
 * semantics team grants need, so encoding it now means the team-grant change is
 * additive rather than a behaviour change.
 */
export function resolveGrant(
  state: FlowboardState,
  resourceId: string,
  userId: string,
): Grant | undefined {
  const subjects = subjectsOf(state, userId);

  const matches = state.grants.filter(
    (grant) =>
      grant.resourceId === resourceId && subjects.includes(grant.subjectId),
  );

  return matches.find((grant) => grant.mode === "deny") ?? matches[0];
}

/**
 * Whether the user may see a container.
 *
 * Order matters here, and getting it wrong is subtle. **Structural** checks run
 * before the admin bypass; only the *grant and visibility* decision is
 * bypassed:
 *
 *   1. Not a member of the workspace → denied.
 *   2. Missing, orphaned or cyclic chain → denied. Failing closed means a stale
 *      id cannot resolve to something a selector then treats as real.
 *   3. Node outside the scoped workspace → denied. An admin of one workspace is
 *      not an admin of every workspace, and this is the check the whole
 *      multi-workspace guarantee rests on.
 *   4. Archived anywhere in the chain → denied. Archive is state, not access,
 *      so it is not something a role can see past.
 *   5. Admin bypass — expressed as a capability lookup rather than a role
 *      comparison, so what admins bypass is itself configurable.
 *   6. Walk the chain root-first, carrying one boolean. `private` resets it to
 *      denied; an explicit grant overrides it for that node and, by
 *      inheritance, its subtree. The **nearest grant wins**, because a later
 *      iteration overwrites an earlier one.
 */
export function canView(
  state: FlowboardState,
  scope: Scope,
  nodeId: string,
  table: CapabilityTable = ROLE_CAPABILITIES,
): boolean {
  const role = roleOf(state, scope.workspaceId, scope.userId);

  if (role === null) return false;

  const chain = ancestorChain(state, nodeId);

  if (chain.length === 0) return false;

  /*
   * Every node in the chain must belong to the scoped workspace, not just the
   * root. `workspaceId` is denormalized, so checking only the root would let a
   * node whose own `workspaceId` disagrees with its parent chain slip through —
   * which is exactly the corruption the denormalization risks.
   */
  if (chain.some((node) => node.workspaceId !== scope.workspaceId))
    return false;
  if (chain.some((node) => node.archivedAt !== null)) return false;

  if (roleBypassesChecks(role, table)) return true;

  let visible = true;

  for (const node of chain) {
    if (node.visibility === "private") visible = false;

    const grant = resolveGrant(state, node.id, scope.userId);

    if (grant) {
      visible = grant.mode === "allow";
    }
  }

  return visible;
}

/**
 * Whether the user can *reach* a node through the tree, not merely view it.
 *
 * These differ, and the difference is a direct consequence of "nearest grant
 * wins". An `allow` on a list overrides a denied ancestor for that list, so
 * `canView(list)` is true — but `selectVisibleTree` builds each level from the
 * one above and stops at the ancestor the user cannot see, so the list never
 * appears and nothing navigates to it.
 *
 * Enforcement does not use this: `canView` remains the gate, because a node a
 * user holds an explicit grant on is a node they were deliberately given. What
 * needs it is the access dialog, which would otherwise tell an admin that a
 * member has access to a list the member cannot actually find
 * (Requirement 8.16).
 */
export function canReach(
  state: FlowboardState,
  scope: Scope,
  nodeId: string,
  table: CapabilityTable = ROLE_CAPABILITIES,
): boolean {
  const chain = ancestorChain(state, nodeId);

  if (chain.length === 0) return false;

  return chain.every((node) => canView(state, scope, node.id, table));
}

/**
 * Tasks are not granted individually. A task is visible exactly when its
 * primary list is visible (Requirement 8.8).
 */
export function canViewTask(
  state: FlowboardState,
  scope: Scope,
  taskId: string,
  table: CapabilityTable = ROLE_CAPABILITIES,
): boolean {
  const task = findTask(state, taskId);

  if (!task) return false;
  if (task.workspaceId !== scope.workspaceId) return false;

  return canView(state, scope, task.primaryListId, table);
}

/**
 * Whether the user holds `capability` over `resourceId`.
 *
 * The policy lives entirely in `ROLE_CAPABILITIES`, so this function has no
 * role-specific branches. Adding a role is a table entry (Requirement 21.7).
 */
export function can(
  state: FlowboardState,
  scope: Scope,
  capability: Capability,
  resourceId: string,
  table: CapabilityTable = ROLE_CAPABILITIES,
): boolean {
  const role = roleOf(state, scope.workspaceId, scope.userId);

  if (role === null) return false;

  /*
   * Visibility is checked for everyone, admins included. `canView` already
   * applies the bypass to the grant decision while still enforcing the
   * structural rules, so an admin cannot mutate an archived, missing or
   * foreign-workspace resource.
   */
  if (!canView(state, scope, resourceId, table)) return false;

  return roleHasCapability(role, capability, table);
}

/**
 * Capability check in `AppError | null` form, for the mutation pipeline.
 *
 * The message names the capability, producing errors like
 * "You don't have permission to archive spaces, folders and lists."
 */
export function requireCapability(
  state: FlowboardState,
  scope: Scope,
  capability: Capability,
  resourceId: string,
  table: CapabilityTable = ROLE_CAPABILITIES,
): AppError | null {
  if (can(state, scope, capability, resourceId, table)) return null;

  const role = roleOf(state, scope.workspaceId, scope.userId);

  if (role === null) {
    return {
      code: "FORBIDDEN",
      message: "You are not a member of this workspace.",
    };
  }

  /*
   * Distinguishing "cannot see it" from "can see it but cannot change it"
   * matters: the first is a navigation problem, the second is a role problem,
   * and the UI words them differently (Requirement 8.11, 14.5).
   */
  if (!canView(state, scope, resourceId, table)) {
    return {
      code: "FORBIDDEN",
      message: "You don't have access to that item.",
    };
  }

  return {
    code: "FORBIDDEN",
    message: `You don't have permission to ${CAPABILITY_LABELS[capability]}.`,
  };
}

/** Task-scoped capability check, resolving through the task's list. */
export function requireTaskCapability(
  state: FlowboardState,
  scope: Scope,
  capability: Capability,
  taskId: string,
  table: CapabilityTable = ROLE_CAPABILITIES,
): AppError | null {
  const task = findTask(state, taskId);

  if (!task || task.workspaceId !== scope.workspaceId) {
    return { code: "NOT_FOUND", message: "That task no longer exists." };
  }

  return requireCapability(state, scope, capability, task.primaryListId, table);
}

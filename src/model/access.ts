import { roleBypassesChecks, type Capability } from "@/config/capabilities";
import {
  isGrantableType,
  type ContainerTypeConfig,
  type Visibility,
} from "@/config/containers";

import { findContainer, type FlowboardState } from "./state";
import type { Grant, GrantSubjectType } from "./types";

/**
 * Container access, in the one shape the UI and the Controller both speak.
 *
 * The permission engine resolves visibility from `Container.visibility` plus a
 * flat list of `Grant` rows, which is the right storage model and the wrong
 * thing to put in front of an admin. This module is the translation between
 * the two, in both directions:
 *
 *   state  →  `accessForContainer`   →  ContainerAccess  (what to show)
 *   ContainerAccess  →  `grantRowsForAccess`  →  Grant[] (what to store)
 *
 * The pairing is deliberate. Because one rule table drives both functions, a
 * saved access list reads back as the same access list — a round-trip property
 * `access.test.ts` asserts directly, rather than two hand-written mappings
 * that agree until someone edits one of them.
 *
 * Pure and React-free like the rest of the Model, so the same translation would
 * run unchanged on a server (Requirement 21.12).
 */
export interface ContainerAccess {
  readonly visibility: Visibility;
  /**
   * The members who have access **by this container's own rule**.
   *
   * Never includes a role that bypasses checks: an admin's access is not
   * something this list can grant or withhold, so listing them here would
   * imply a control that does not exist.
   *
   * Note "by this container's own rule". A `public` container permits everyone
   * it does not explicitly deny, but a member still has to be able to reach
   * the container through its ancestors — which is what `canReach` answers and
   * what the access dialog surfaces per member.
   */
  readonly memberIds: readonly string[];
}

/**
 * How each visibility expresses "these members have access" as grant rows.
 *
 * Declared as data rather than as a pair of conditionals so the mapping is
 * enumerable by reading one table, and so adding a third visibility is a
 * compile error here rather than a silent fall-through to the `public`
 * behaviour (Requirement 21.15, 21.18).
 */
interface AccessRule {
  /** The mode of the grant rows this visibility writes. */
  readonly grantMode: Grant["mode"];
  /**
   * Whether carrying a row of that mode *means* the member has access.
   *
   * `private` grants access explicitly, so a row means access. `public` grants
   * it by default, so a row means the opposite — which is why one boolean is
   * enough to drive both the read and the write.
   */
  readonly grantMeansAccess: boolean;
}

const ACCESS_RULE: Record<Visibility, AccessRule> = {
  private: { grantMode: "allow", grantMeansAccess: true },
  public: { grantMode: "deny", grantMeansAccess: false },
};

/**
 * A newly created container is reachable only by roles that bypass checks
 * until someone says otherwise.
 *
 * This is the behaviour change: creation used to default to `public`, which
 * handed every member of the workspace access to a container nobody had
 * decided to share. Permissions are the one place where defaulting *open* is
 * the wrong default, so this fails closed and the create form asks
 * (Requirement 8.15).
 */
export const RESTRICTED_ACCESS: ContainerAccess = {
  visibility: "private",
  memberIds: [],
};

/** Everyone in the workspace, with no exclusions. The pre-8.15 behaviour. */
export const OPEN_ACCESS: ContainerAccess = {
  visibility: "public",
  memberIds: [],
};

/**
 * The access a container of this type gets when the caller does not say.
 *
 * Resolved from the registry's `grantable` flag rather than from a type
 * comparison: a level that cannot carry a grant has no way back from
 * `private`, so locking one down would make it permanently invisible
 * (Requirement 21.4).
 */
export function defaultAccessFor(
  type: string,
  registry?: Partial<Record<string, ContainerTypeConfig<string>>>,
): ContainerAccess {
  const grantable =
    registry === undefined
      ? isGrantableType(type)
      : isGrantableType(type, registry);

  return grantable ? RESTRICTED_ACCESS : OPEN_ACCESS;
}

/** An injectable capability table, matching the permission engine's seam. */
type CapabilityTable = Partial<Record<string, ReadonlySet<Capability>>>;

/**
 * Workspace members whose visibility this access list actually governs.
 *
 * Excludes any role holding `workspace:bypass`, read through the capability
 * table rather than compared against `"admin"`, so demoting what admins bypass
 * stays a table edit (Requirement 21.7).
 */
export function governedMemberIds(
  state: FlowboardState,
  workspaceId: string,
  table?: CapabilityTable,
): readonly string[] {
  return state.memberships
    .filter(
      (membership) =>
        membership.workspaceId === workspaceId &&
        !(table === undefined
          ? roleBypassesChecks(membership.role)
          : roleBypassesChecks(membership.role, table)),
    )
    .map((membership) => membership.userId);
}

/** Which grant subjects this module treats as a user. Total over the union. */
const USER_SUBJECT: Record<GrantSubjectType, boolean> = { user: true };

/**
 * Whether a grant's subject is a user.
 *
 * A table lookup rather than a `=== "user"` comparison, which buys two things
 * the comparison does not. Widening `GrantSubjectType` leaves `USER_SUBJECT`
 * missing a key, so it becomes a compile error here instead of a filter that
 * silently starts deleting team rows — the exact failure the discriminated
 * subject exists to prevent (Requirement 21.8). And a subject type from
 * outside the union reads as `undefined` rather than as a match, so such a row
 * is preserved rather than dropped by the next access save; the persisted
 * payload is validated for shape, not for subject values, so that is a path
 * data can actually arrive by.
 */
function isUserSubject(grant: Grant): boolean {
  // Read through a widened view, so an out-of-union key is `undefined` here
  // rather than a type the declaration promises and the data does not keep.
  const table: Partial<Record<string, boolean>> = USER_SUBJECT;

  return table[grant.subjectType] ?? false;
}

/** The user-subject grant rows attached to one container. */
function userGrantsFor(
  state: FlowboardState,
  workspaceId: string,
  resourceId: string,
): readonly Grant[] {
  return state.grants.filter(
    (grant) =>
      grant.workspaceId === workspaceId &&
      grant.resourceId === resourceId &&
      isUserSubject(grant),
  );
}

/**
 * Who currently has access to `containerId` by its own rule.
 *
 * A container that no longer exists reads as restricted rather than open, for
 * the same reason `canView` fails closed on a broken chain: a stale id must not
 * resolve to something permissive.
 */
export function accessForContainer(
  state: FlowboardState,
  workspaceId: string,
  containerId: string,
  table?: CapabilityTable,
): ContainerAccess {
  const container = findContainer(state, containerId);

  if (!container || container.workspaceId !== workspaceId) {
    return RESTRICTED_ACCESS;
  }

  const rule = ACCESS_RULE[container.visibility];
  const flagged = new Set(
    userGrantsFor(state, workspaceId, containerId)
      .filter((grant) => grant.mode === rule.grantMode)
      .map((grant) => grant.subjectId),
  );

  return {
    visibility: container.visibility,
    memberIds: governedMemberIds(state, workspaceId, table).filter(
      (userId) => flagged.has(userId) === rule.grantMeansAccess,
    ),
  };
}

/**
 * The grant rows that express `access` on `resourceId`.
 *
 * The exact inverse of `accessForContainer`, driven by the same rule table: a
 * row is written for the members whose access state is the one the grant marks.
 * Members not named in the result are governed by the container's
 * `visibility` alone, which is what keeps the grant array proportional to the
 * exceptions rather than to the membership list.
 */
export function grantRowsForAccess(
  state: FlowboardState,
  workspaceId: string,
  resourceId: string,
  access: ContainerAccess,
  table?: CapabilityTable,
): readonly Grant[] {
  const rule = ACCESS_RULE[access.visibility];
  const chosen = new Set(access.memberIds);

  return governedMemberIds(state, workspaceId, table)
    .filter((userId) => chosen.has(userId) === rule.grantMeansAccess)
    .map((userId) => ({
      workspaceId,
      resourceId,
      subjectId: userId,
      subjectType: "user" as const,
      mode: rule.grantMode,
    }));
}

/**
 * Every grant except the user-subject rows on `resourceId`.
 *
 * What a save replaces, and the reason it is narrowed twice. Dropping rows for
 * other resources would silently rewrite the rest of the workspace's
 * permissions; dropping non-user subjects would mean that adding team grants
 * makes every access save quietly delete them (Requirement 21.8).
 */
export function grantsExcluding(
  grants: readonly Grant[],
  workspaceId: string,
  resourceId: string,
): readonly Grant[] {
  return grants.filter(
    (grant) =>
      !(
        grant.workspaceId === workspaceId &&
        grant.resourceId === resourceId &&
        isUserSubject(grant)
      ),
  );
}

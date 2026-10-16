import type {
  Container,
  Grant,
  Membership,
  Status,
  Task,
  User,
} from "./types";

/**
 * The normalized domain state.
 *
 * Entities live in `Record<id, entity>` maps so every mutation is an O(1)
 * write. Ordering is never stored as an array — it is always derived by sorting
 * on `position`, which means a reorder touches exactly one entity.
 *
 * Note what is deliberately absent: there is no `workspaceId: string` singleton
 * naming "the" workspace. `activeWorkspaceId` is a cursor into a set, and every
 * collection selector takes a scope (Requirement 21.1, 21.2).
 */
export interface FlowboardState {
  readonly version: 1;
  /** Which workspace the UI is currently scoped to. */
  readonly activeWorkspaceId: string;
  /** Workspace nodes live in `containers` with type 'workspace'; this indexes them. */
  readonly workspaceIds: readonly string[];
  readonly containers: Readonly<Record<string, Container>>;
  readonly tasks: Readonly<Record<string, Task>>;
  readonly statuses: Readonly<Record<string, Status>>;
  readonly users: Readonly<Record<string, User>>;
  readonly memberships: readonly Membership[];
  readonly grants: readonly Grant[];
}

/** The mutable form, for use inside immer drafts in the Controller. */
export interface MutableFlowboardState {
  version: 1;
  activeWorkspaceId: string;
  workspaceIds: string[];
  containers: Record<string, Container>;
  tasks: Record<string, Task>;
  statuses: Record<string, Status>;
  users: Record<string, User>;
  memberships: Membership[];
  grants: Grant[];
}

export const STATE_VERSION = 1 as const;

/** An empty state, used as a base by the seed and by test fixtures. */
export function createEmptyState(): FlowboardState {
  return {
    version: STATE_VERSION,
    activeWorkspaceId: "",
    workspaceIds: [],
    containers: {},
    tasks: {},
    statuses: {},
    users: {},
    memberships: [],
    grants: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

/*
 * `noUncheckedIndexedAccess` is on, so every map lookup is `T | undefined`.
 * These helpers keep that honest at the boundary instead of scattering
 * non-null assertions through the selectors.
 */

export function findContainer(
  state: FlowboardState,
  id: string,
): Container | undefined {
  return state.containers[id];
}

export function findTask(state: FlowboardState, id: string): Task | undefined {
  return state.tasks[id];
}

export function findStatus(
  state: FlowboardState,
  id: string,
): Status | undefined {
  return state.statuses[id];
}

export function findUser(state: FlowboardState, id: string): User | undefined {
  return state.users[id];
}

/* -------------------------------------------------------------------------- */
/* Workspace scoping                                                          */
/* -------------------------------------------------------------------------- */

/**
 * All containers in a workspace, live only. The `workspaceId` filter is the
 * reason this is O(n) over one workspace rather than O(n · depth).
 */
export function containersInWorkspace(
  state: FlowboardState,
  workspaceId: string,
  options: { includeArchived?: boolean } = {},
): Container[] {
  return Object.values(state.containers).filter(
    (container) =>
      container.workspaceId === workspaceId &&
      (options.includeArchived === true || container.archivedAt === null),
  );
}

export function tasksInWorkspace(
  state: FlowboardState,
  workspaceId: string,
): Task[] {
  return Object.values(state.tasks).filter(
    (task) => task.workspaceId === workspaceId,
  );
}

export function statusesInWorkspace(
  state: FlowboardState,
  workspaceId: string,
): Status[] {
  return Object.values(state.statuses).filter(
    (status) => status.workspaceId === workspaceId,
  );
}

/** Users holding a membership in the workspace. */
export function usersInWorkspace(
  state: FlowboardState,
  workspaceId: string,
): User[] {
  return state.memberships
    .filter((membership) => membership.workspaceId === workspaceId)
    .map((membership) => state.users[membership.userId])
    .filter((user): user is User => user !== undefined);
}

export function grantsForResource(
  state: FlowboardState,
  resourceId: string,
): Grant[] {
  return state.grants.filter((grant) => grant.resourceId === resourceId);
}

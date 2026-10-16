import { POSITION_GAP } from "@/config/limits";
import { createSeedState } from "@/model/seed";
import { STATE_VERSION, type FlowboardState } from "@/model/state";
import type {
  Container,
  Grant,
  Membership,
  Scope,
  Status,
  Task,
  User,
} from "@/model/types";

/**
 * Test fixtures.
 *
 * Two kinds live here: helpers for building small synthetic states where a
 * single rule is under test, and a second workspace that exists only in tests.
 */

export const SEED_NOW = "2026-10-16T09:00:00.000Z";

/** A scope for the seeded workspace. */
export function scopeFor(userId: string, workspaceId = "ws-acme"): Scope {
  return { workspaceId, userId };
}

/* -------------------------------------------------------------------------- */
/* Builders                                                                   */
/* -------------------------------------------------------------------------- */

let sequence = 0;

function nextPosition(): number {
  sequence += 1;
  return sequence * POSITION_GAP;
}

export function aContainer(overrides: Partial<Container> = {}): Container {
  return {
    id: `c-${String(++sequence)}`,
    workspaceId: "ws-test",
    name: "Container",
    type: "space",
    parentId: "ws-test",
    position: nextPosition(),
    visibility: "public",
    archivedAt: null,
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    ...overrides,
  };
}

export function aTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `t-${String(++sequence)}`,
    workspaceId: "ws-test",
    primaryListId: "li-test",
    parentTaskId: null,
    title: "Task",
    description: null,
    statusId: "st-test",
    priority: "normal",
    assigneeIds: [],
    dueDate: null,
    position: nextPosition(),
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    ...overrides,
  };
}

export function aStatus(overrides: Partial<Status> = {}): Status {
  return {
    id: `st-${String(++sequence)}`,
    workspaceId: "ws-test",
    listId: "li-test",
    name: "To do",
    category: "todo",
    color: "status-todo",
    position: nextPosition(),
    ...overrides,
  };
}

export function aUser(overrides: Partial<User> = {}): User {
  return {
    id: `u-${String(++sequence)}`,
    name: "Test User",
    email: "test@acme.test",
    avatarToken: "avatar-indigo",
    ...overrides,
  };
}

function byId<T extends { id: string }>(items: readonly T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

/** Assembles a state from loose entities. Anything omitted is empty. */
export function aState(parts: {
  containers?: readonly Container[];
  tasks?: readonly Task[];
  statuses?: readonly Status[];
  users?: readonly User[];
  memberships?: readonly Membership[];
  grants?: readonly Grant[];
  activeWorkspaceId?: string;
}): FlowboardState {
  const activeWorkspaceId = parts.activeWorkspaceId ?? "ws-test";

  return {
    version: STATE_VERSION,
    activeWorkspaceId,
    workspaceIds: [activeWorkspaceId],
    containers: byId(parts.containers ?? []),
    tasks: byId(parts.tasks ?? []),
    statuses: byId(parts.statuses ?? []),
    users: byId(parts.users ?? []),
    memberships: [...(parts.memberships ?? [])],
    grants: [...(parts.grants ?? [])],
  };
}

/**
 * A minimal workspace with one admin and one member, for permission tests.
 * Returns the state plus the ids, so tests do not repeat string literals.
 */
export function aWorkspaceWith(
  containers: readonly Container[],
  grants: readonly Grant[] = [],
): FlowboardState {
  const root = aContainer({
    id: "ws-test",
    name: "Test",
    type: "workspace",
    parentId: null,
    workspaceId: "ws-test",
  });

  return aState({
    containers: [root, ...containers],
    users: [
      aUser({ id: "u-admin", name: "Admin" }),
      aUser({ id: "u-member", name: "Member" }),
      aUser({ id: "u-other", name: "Other" }),
    ],
    memberships: [
      { workspaceId: "ws-test", userId: "u-admin", role: "admin" },
      { workspaceId: "ws-test", userId: "u-member", role: "member" },
      { workspaceId: "ws-test", userId: "u-other", role: "member" },
    ],
    grants,
  });
}

export function aGrant(
  resourceId: string,
  subjectId: string,
  mode: "allow" | "deny",
  workspaceId = "ws-test",
): Grant {
  return { workspaceId, resourceId, subjectId, subjectType: "user", mode };
}

/* -------------------------------------------------------------------------- */
/* Two-workspace fixture                                                      */
/* -------------------------------------------------------------------------- */

export const OTHER_WORKSPACE_ID = "ws-other";

/**
 * The seeded workspace plus a second one that must never appear in any
 * `ws-acme`-scoped result.
 *
 * This exists only in tests, never in the app seed. It is what keeps workspace
 * scoping honest: a selector that forgets to filter on `workspaceId` passes
 * every single-workspace test and fails here (Requirement 18.10).
 */
export function aTwoWorkspaceState(): FlowboardState {
  const seeded = createSeedState();

  const otherRoot: Container = {
    id: OTHER_WORKSPACE_ID,
    workspaceId: OTHER_WORKSPACE_ID,
    name: "Other Co",
    type: "workspace",
    parentId: null,
    position: POSITION_GAP,
    visibility: "public",
    archivedAt: null,
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
  };

  const otherSpace: Container = {
    ...otherRoot,
    id: "sp-other",
    name: "Other Space",
    type: "space",
    parentId: OTHER_WORKSPACE_ID,
  };

  const otherList: Container = {
    ...otherRoot,
    id: "li-other",
    name: "Other List",
    type: "list",
    parentId: "sp-other",
  };

  const otherStatus: Status = {
    id: "st-other",
    workspaceId: OTHER_WORKSPACE_ID,
    listId: "li-other",
    name: "To do",
    category: "todo",
    color: "status-todo",
    position: POSITION_GAP,
  };

  const otherTasks: Task[] = [
    {
      id: "t-other-1",
      workspaceId: OTHER_WORKSPACE_ID,
      primaryListId: "li-other",
      parentTaskId: null,
      title: "Should never appear in an Acme result",
      description: "Nor should this description match an Acme search.",
      statusId: "st-other",
      priority: "urgent",
      assigneeIds: [],
      dueDate: null,
      position: POSITION_GAP,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    {
      id: "t-other-2",
      workspaceId: OTHER_WORKSPACE_ID,
      primaryListId: "li-other",
      parentTaskId: null,
      title: "Also hidden from Acme",
      description: null,
      statusId: "st-other",
      priority: "low",
      assigneeIds: [],
      dueDate: null,
      position: POSITION_GAP * 2,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  ];

  return {
    ...seeded,
    workspaceIds: [...seeded.workspaceIds, OTHER_WORKSPACE_ID],
    containers: {
      ...seeded.containers,
      [otherRoot.id]: otherRoot,
      [otherSpace.id]: otherSpace,
      [otherList.id]: otherList,
    },
    statuses: { ...seeded.statuses, [otherStatus.id]: otherStatus },
    tasks: {
      ...seeded.tasks,
      ...Object.fromEntries(otherTasks.map((task) => [task.id, task])),
    },
    /*
     * Alice is an admin of Acme and a MEMBER of the other workspace, and Bob is
     * a member of neither. That combination is what catches a bypass check that
     * forgets to resolve role per workspace.
     */
    memberships: [
      ...seeded.memberships,
      { workspaceId: OTHER_WORKSPACE_ID, userId: "u-alice", role: "member" },
    ],
  };
}

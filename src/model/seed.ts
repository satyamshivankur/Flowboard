import { POSITION_GAP } from "@/config/limits";
import {
  DEFAULT_STATUS_TEMPLATE,
  type StatusCategory,
  type StatusColorToken,
} from "@/config/statusCategories";

import { STATE_VERSION, type FlowboardState } from "./state";
import type { Container, Grant, Membership, Status, Task, User } from "./types";

/**
 * Deterministic seed fixtures.
 *
 * Fixed IDs and a fixed reference date, so snapshots, assertions and the demo
 * are identical on every run (Requirement 9.3). Dates are derived from
 * `SEED_NOW` rather than `Date.now()`, which is what lets a test assert "this
 * task is overdue" without the suite rotting overnight.
 */

/** The reference "now" every seeded date is derived from. */
export const SEED_NOW = "2026-10-16T09:00:00.000Z";

export const WORKSPACE_ID = "ws-acme";

const DAY_MS = 86_400_000;

/** A date offset from SEED_NOW by whole days. Negative is in the past. */
function daysFromSeedNow(days: number): string {
  return new Date(Date.parse(SEED_NOW) + days * DAY_MS).toISOString();
}

/** Sequential sibling position, 1-indexed. */
function pos(index: number): number {
  return index * POSITION_GAP;
}

/* -------------------------------------------------------------------------- */
/* Users and memberships                                                      */
/* -------------------------------------------------------------------------- */

const users: User[] = [
  {
    id: "u-alice",
    name: "Alice Nguyen",
    email: "alice@acme.test",
    avatarToken: "avatar-indigo",
  },
  {
    id: "u-bob",
    name: "Bob Mensah",
    email: "bob@acme.test",
    avatarToken: "avatar-teal",
  },
  {
    id: "u-carol",
    name: "Carol Diaz",
    email: "carol@acme.test",
    avatarToken: "avatar-amber",
  },
];

/**
 * Role lives here, not on the user. With one workspace this looks like
 * indirection for its own sake; it is what makes a second workspace a data
 * change rather than a refactor (Requirement 21.3).
 */
const memberships: Membership[] = [
  { workspaceId: WORKSPACE_ID, userId: "u-alice", role: "admin" },
  { workspaceId: WORKSPACE_ID, userId: "u-bob", role: "member" },
  { workspaceId: WORKSPACE_ID, userId: "u-carol", role: "member" },
];

/* -------------------------------------------------------------------------- */
/* Hierarchy                                                                  */
/* -------------------------------------------------------------------------- */

/*
 * Workspace "Acme"                                    public
 * ├── Space "Engineering"                             public
 * │   ├── Folder "Q2 Launch"                          public
 * │   │   ├── List "Backlog"                          6 tasks
 * │   │   └── List "Sprint 14"                        6 tasks (+2 subtasks)
 * │   └── Folder "Platform"                           public
 * │       └── List "Infra"                            5 tasks
 * └── Space "Marketing"                               PRIVATE
 */

function container(
  overrides: Omit<Container, "workspaceId" | "createdAt" | "updatedAt"> &
    Partial<Pick<Container, "createdAt" | "updatedAt">>,
): Container {
  return {
    workspaceId: WORKSPACE_ID,
    createdAt: daysFromSeedNow(-30),
    updatedAt: daysFromSeedNow(-30),
    ...overrides,
  };
}

const containers: Container[] = [
  container({
    id: WORKSPACE_ID,
    name: "Acme",
    type: "workspace",
    parentId: null,
    position: pos(1),
    visibility: "public",
    archivedAt: null,
  }),
  container({
    id: "sp-eng",
    name: "Engineering",
    type: "space",
    parentId: WORKSPACE_ID,
    position: pos(1),
    visibility: "public",
    archivedAt: null,
  }),
  /*
   * The private space. Carol holds an explicit allow; Bob does not, so this is
   * half of the "Alice vs Bob in under 30 seconds" demo (Requirement 8.14).
   */
  container({
    id: "sp-marketing",
    name: "Marketing",
    type: "space",
    parentId: WORKSPACE_ID,
    position: pos(2),
    visibility: "private",
    archivedAt: null,
  }),
  container({
    id: "fo-q2",
    name: "Q2 Launch",
    type: "folder",
    parentId: "sp-eng",
    position: pos(1),
    visibility: "public",
    archivedAt: null,
  }),
  container({
    id: "fo-platform",
    name: "Platform",
    type: "folder",
    parentId: "sp-eng",
    position: pos(2),
    visibility: "public",
    archivedAt: null,
  }),
  container({
    id: "li-backlog",
    name: "Backlog",
    type: "list",
    parentId: "fo-q2",
    position: pos(1),
    visibility: "public",
    archivedAt: null,
  }),
  container({
    id: "li-sprint14",
    name: "Sprint 14",
    type: "list",
    parentId: "fo-q2",
    position: pos(2),
    visibility: "public",
    archivedAt: null,
  }),
  /*
   * Public, but Bob carries an explicit deny. This proves deny beats public
   * inheritance, and leaves Platform visible to Bob with no visible children —
   * which is what Requirement 6.8's empty-folder hint exists for.
   */
  container({
    id: "li-infra",
    name: "Infra",
    type: "list",
    parentId: "fo-platform",
    position: pos(1),
    visibility: "public",
    archivedAt: null,
  }),
];

/* -------------------------------------------------------------------------- */
/* Grants                                                                     */
/* -------------------------------------------------------------------------- */

const grants: Grant[] = [
  {
    workspaceId: WORKSPACE_ID,
    resourceId: "sp-marketing",
    subjectId: "u-carol",
    subjectType: "user",
    mode: "allow",
  },
  {
    workspaceId: WORKSPACE_ID,
    resourceId: "li-infra",
    subjectId: "u-bob",
    subjectType: "user",
    mode: "deny",
  },
];

/* -------------------------------------------------------------------------- */
/* Statuses — owned per list                                                  */
/* -------------------------------------------------------------------------- */

function status(
  id: string,
  listId: string,
  name: string,
  category: Status["category"],
  color: Status["color"],
  index: number,
): Status {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    listId,
    name,
    category,
    color,
    position: pos(index),
  };
}

/** One extra status spliced into a list's default set, after a named category. */
interface ExtraStatusSeed {
  readonly id: string;
  readonly name: string;
  readonly category: StatusCategory;
  readonly color: StatusColorToken;
  /** The category this status is inserted after. */
  readonly after: StatusCategory;
}

/**
 * A list's status set, expanded from `DEFAULT_STATUS_TEMPLATE`.
 *
 * The same declaration `containerSlice.create` reads, so a seeded list and one
 * created in the app cannot disagree about what the default set is
 * (Requirement 3.3). Ids are built from the list's abbreviation and the
 * category — `st-bk-todo` — rather than generated, because the fixtures are
 * deliberately deterministic (Requirement 9.3).
 *
 * `extra` is how Sprint 14 gets its fourth status, which is what makes
 * per-list sets visibly distinct (Requirement 3.4).
 */
function statusesFor(
  listId: string,
  idPrefix: string,
  extra?: ExtraStatusSeed,
): Status[] {
  const base = DEFAULT_STATUS_TEMPLATE.map((template) => ({
    id: `st-${idPrefix}-${template.category}`,
    name: template.name,
    category: template.category,
    color: template.color,
  }));

  const entries =
    extra === undefined
      ? base
      : base.flatMap((entry) =>
          entry.category === extra.after ? [entry, extra] : [entry],
        );

  return entries.map((entry, index) =>
    status(
      entry.id,
      listId,
      entry.name,
      entry.category,
      entry.color,
      index + 1,
    ),
  );
}

const statuses: Status[] = [
  ...statusesFor("li-backlog", "bk"),
  ...statusesFor("li-sprint14", "sp", {
    id: "st-sp-review",
    name: "In review",
    category: "active",
    color: "status-review",
    after: "active",
  }),
  ...statusesFor("li-infra", "in"),
];

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

interface TaskSeed {
  id: string;
  listId: string;
  statusId: string;
  title: string;
  description?: string;
  priority: Task["priority"];
  assigneeIds?: string[];
  /** Days from SEED_NOW. Omit for no due date. */
  dueInDays?: number;
  index: number;
  parentTaskId?: string;
}

function task(seed: TaskSeed): Task {
  return {
    id: seed.id,
    workspaceId: WORKSPACE_ID,
    primaryListId: seed.listId,
    parentTaskId: seed.parentTaskId ?? null,
    title: seed.title,
    description: seed.description ?? null,
    statusId: seed.statusId,
    priority: seed.priority,
    assigneeIds: seed.assigneeIds ?? [],
    dueDate:
      seed.dueInDays === undefined ? null : daysFromSeedNow(seed.dueInDays),
    position: pos(seed.index),
    createdAt: daysFromSeedNow(-14),
    updatedAt: daysFromSeedNow(-1),
  };
}

const taskSeeds: TaskSeed[] = [
  /* ----------------------------- Backlog (6) ----------------------------- */
  {
    id: "t-001",
    listId: "li-backlog",
    statusId: "st-bk-todo",
    title: "Define onboarding checklist for new workspaces",
    description:
      "Capture the steps a new team takes in their first session, and which ones we can automate.",
    priority: "high",
    assigneeIds: ["u-alice"],
    dueInDays: 6,
    index: 1,
  },
  {
    id: "t-002",
    listId: "li-backlog",
    statusId: "st-bk-todo",
    // No due date — exercises the "nulls sort last" rule in both directions.
    title: "Audit empty states across the product",
    priority: "low",
    assigneeIds: ["u-carol"],
    index: 2,
  },
  {
    id: "t-003",
    listId: "li-backlog",
    statusId: "st-bk-todo",
    // Unassigned — exercises the empty AvatarGroup.
    title: "Draft the Q3 roadmap outline",
    priority: "none",
    index: 3,
  },
  {
    id: "t-004",
    listId: "li-backlog",
    statusId: "st-bk-active",
    title: "Rework the task detail layout",
    description: "Two-column property grid, consistent row height.",
    priority: "normal",
    assigneeIds: ["u-bob", "u-carol"],
    dueInDays: 9,
    index: 1,
  },
  {
    id: "t-005",
    listId: "li-backlog",
    statusId: "st-bk-active",
    title: "Replace ad-hoc spacing with the shared scale",
    priority: "normal",
    assigneeIds: ["u-bob"],
    dueInDays: 3,
    index: 2,
  },
  {
    id: "t-006",
    listId: "li-backlog",
    statusId: "st-bk-done",
    title: "Agree the colour token naming scheme",
    priority: "low",
    assigneeIds: ["u-alice"],
    dueInDays: -5,
    index: 1,
  },

  /* ---------------------------- Sprint 14 (6) ---------------------------- */
  {
    id: "t-007",
    listId: "li-sprint14",
    statusId: "st-sp-todo",
    title: "Add keyboard navigation to the sidebar tree",
    priority: "high",
    assigneeIds: ["u-bob"],
    dueInDays: 2,
    index: 1,
  },
  {
    id: "t-008",
    listId: "li-sprint14",
    statusId: "st-sp-todo",
    // Due today — the warning tone on DueDateChip.
    title: "Announce the Sprint 14 scope in #eng",
    priority: "normal",
    assigneeIds: ["u-carol"],
    dueInDays: 0,
    index: 2,
  },
  {
    id: "t-009",
    listId: "li-sprint14",
    statusId: "st-sp-active",
    // Urgent AND overdue, and the parent of the two subtasks below.
    title: "Wire up the auth guard",
    description:
      "Redirect unauthenticated users to the sign-in screen and preserve the intended destination.",
    priority: "urgent",
    assigneeIds: ["u-alice", "u-bob"],
    dueInDays: -4,
    index: 1,
  },
  {
    id: "t-010",
    listId: "li-sprint14",
    statusId: "st-sp-active",
    title: "Persist board column order",
    priority: "normal",
    assigneeIds: ["u-bob"],
    dueInDays: 5,
    index: 2,
  },
  {
    id: "t-011",
    listId: "li-sprint14",
    statusId: "st-sp-review",
    title: "Tighten the drag-and-drop drop targets",
    description: "Highlight the insertion point, not just the column.",
    priority: "high",
    assigneeIds: ["u-carol"],
    dueInDays: 1,
    index: 1,
  },
  {
    id: "t-012",
    listId: "li-sprint14",
    statusId: "st-sp-done",
    title: "Ship the toast component",
    priority: "normal",
    assigneeIds: ["u-alice"],
    dueInDays: -2,
    index: 1,
  },

  /* ------------------------------ Infra (5) ------------------------------ */
  {
    id: "t-013",
    listId: "li-infra",
    statusId: "st-in-todo",
    title: "Pin build tooling to exact versions",
    priority: "normal",
    assigneeIds: ["u-carol"],
    dueInDays: 7,
    index: 1,
  },
  {
    id: "t-014",
    listId: "li-infra",
    statusId: "st-in-todo",
    title: "Add a unit guard to the lint step",
    priority: "low",
    assigneeIds: ["u-alice"],
    index: 2,
  },
  {
    id: "t-015",
    listId: "li-infra",
    statusId: "st-in-active",
    title: "Split the CI pipeline into lint, typecheck and test",
    priority: "high",
    assigneeIds: ["u-carol"],
    dueInDays: 4,
    index: 1,
  },
  {
    id: "t-016",
    listId: "li-infra",
    statusId: "st-in-active",
    title: "Document the local setup steps",
    priority: "none",
    index: 2,
  },
  {
    id: "t-017",
    listId: "li-infra",
    statusId: "st-in-done",
    title: "Enable strict TypeScript across the workspace",
    priority: "normal",
    assigneeIds: ["u-alice"],
    dueInDays: -8,
    index: 1,
  },

  /* ------------------- Subtasks of t-009, depth 1 only ------------------- */
  {
    id: "t-009-a",
    listId: "li-sprint14",
    statusId: "st-sp-done",
    title: "Define the guard contract",
    priority: "normal",
    assigneeIds: ["u-alice"],
    index: 1,
    parentTaskId: "t-009",
  },
  {
    id: "t-009-b",
    listId: "li-sprint14",
    statusId: "st-sp-active",
    title: "Add redirect handling",
    priority: "high",
    assigneeIds: ["u-bob"],
    dueInDays: -1,
    index: 2,
    parentTaskId: "t-009",
  },
];

const tasks: Task[] = taskSeeds.map(task);

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

function byId<T extends { id: string }>(
  items: readonly T[],
): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

/**
 * The seeded state: 1 workspace, 2 spaces, 2 folders, 3 lists, 3 users,
 * 10 statuses and 19 tasks (17 top-level plus 2 subtasks) — comfortably over
 * the 15 the brief asks for (Requirement 9.2).
 */
export function createSeedState(): FlowboardState {
  return {
    version: STATE_VERSION,
    activeWorkspaceId: WORKSPACE_ID,
    workspaceIds: [WORKSPACE_ID],
    containers: byId(containers),
    tasks: byId(tasks),
    statuses: byId(statuses),
    users: byId(users),
    memberships,
    grants,
  };
}

/** Stable ids, for tests and for the demo script. */
export const SEED_IDS = {
  workspace: WORKSPACE_ID,
  spaces: { engineering: "sp-eng", marketing: "sp-marketing" },
  folders: { q2: "fo-q2", platform: "fo-platform" },
  lists: { backlog: "li-backlog", sprint14: "li-sprint14", infra: "li-infra" },
  users: { alice: "u-alice", bob: "u-bob", carol: "u-carol" },
  tasks: { urgentOverdue: "t-009", dueToday: "t-008", noDueDate: "t-003" },
} as const;

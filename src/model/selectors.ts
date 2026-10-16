import { CONTAINER_REGISTRY, holdsTasks } from "@/config/containers";
import { PAGE_SIZE } from "@/config/limits";
import { comparePriority } from "@/config/priorities";
import { TERMINAL_STATUS_CATEGORY } from "@/config/statusCategories";
import { compareDueDate } from "@/lib/date";

import { ancestorChain, childContainers, subtasksOf } from "./hierarchy";
import { canView, canViewTask } from "./permissions";
import { sortByPosition } from "./position";
import {
  findContainer,
  findStatus,
  findTask,
  type FlowboardState,
} from "./state";
import type { Container, Scope, SortState, Status, Task, User } from "./types";

/**
 * Pure selectors.
 *
 * Every selector that returns a collection takes a `Scope`, and every one
 * filters through the permission engine, so denied data never reaches the View
 * (Requirement 8.8). Nothing here reads `activeWorkspaceId` — the Controller's
 * `useScope` hook resolves that once and passes it down (Requirement 21.2).
 */

/* -------------------------------------------------------------------------- */
/* Tree                                                                       */
/* -------------------------------------------------------------------------- */

/** A node in the visible tree, with its children already resolved. */
export interface TreeNode {
  readonly container: Container;
  readonly depth: number;
  readonly children: readonly TreeNode[];
  /** True when the node can hold tasks — a list, in the default registry. */
  readonly holdsTasks: boolean;
  /**
   * True when the node has children in the data but none the user may see.
   * Drives the "no visible lists" hint rather than rendering a dead end
   * (Requirement 6.8).
   */
  readonly hasHiddenChildren: boolean;
}

/**
 * The workspace tree, filtered to what the user may see.
 *
 * Archived nodes are excluded by `childContainers`, denied nodes by `canView`.
 * A denied node's subtree is excluded with it, since `canView` walks the chain
 * and the ancestor's deny propagates.
 */
export function selectVisibleTree(
  state: FlowboardState,
  scope: Scope,
): readonly TreeNode[] {
  const root = findContainer(state, scope.workspaceId);

  if (!root) return [];
  if (root.workspaceId !== scope.workspaceId) return [];
  if (!canView(state, scope, root.id)) return [];

  return buildChildren(state, scope, root.id, 1);
}

/** The workspace node itself, when visible. */
export function selectWorkspace(
  state: FlowboardState,
  scope: Scope,
): Container | undefined {
  const root = findContainer(state, scope.workspaceId);

  if (!root || !canView(state, scope, root.id)) return undefined;

  return root;
}

function buildChildren(
  state: FlowboardState,
  scope: Scope,
  parentId: string,
  depth: number,
): readonly TreeNode[] {
  const all = childContainers(state, parentId);
  const visible = all.filter((child) => canView(state, scope, child.id));

  return visible.map((container) => {
    const children = buildChildren(state, scope, container.id, depth + 1);
    const allGrandchildren = childContainers(state, container.id);

    return {
      container,
      depth,
      children,
      holdsTasks: holdsTasks(container.type, CONTAINER_REGISTRY),
      hasHiddenChildren: allGrandchildren.length > children.length,
    };
  });
}

/** Flattens a tree to the rows the sidebar renders, honouring expansion. */
export function flattenTree(
  nodes: readonly TreeNode[],
  expandedIds: ReadonlySet<string>,
): readonly TreeNode[] {
  return nodes.flatMap((node) =>
    expandedIds.has(node.container.id)
      ? [node, ...flattenTree(node.children, expandedIds)]
      : [node],
  );
}

/** Breadcrumb path from the workspace down to `nodeId`, visible nodes only. */
export function selectBreadcrumb(
  state: FlowboardState,
  scope: Scope,
  nodeId: string,
): readonly Container[] {
  if (!canView(state, scope, nodeId)) return [];

  return ancestorChain(state, nodeId).filter((node) =>
    canView(state, scope, node.id),
  );
}

/** Every list the user may see, in tree order. */
export function selectVisibleLists(
  state: FlowboardState,
  scope: Scope,
): readonly Container[] {
  const collect = (nodes: readonly TreeNode[]): Container[] =>
    nodes.flatMap((node) => [
      ...(node.holdsTasks ? [node.container] : []),
      ...collect(node.children),
    ]);

  return collect(selectVisibleTree(state, scope));
}

/**
 * The first list the user may see. Used to recover navigation after a user
 * switch leaves the selected list invisible (Requirement 8.13).
 */
export function selectFirstVisibleList(
  state: FlowboardState,
  scope: Scope,
): Container | undefined {
  return selectVisibleLists(state, scope)[0];
}

/** Ids of every node that must be expanded for `nodeId` to be on screen. */
export function selectExpansionPath(
  state: FlowboardState,
  scope: Scope,
  nodeId: string,
): readonly string[] {
  return selectBreadcrumb(state, scope, nodeId)
    .slice(0, -1)
    .map((node) => node.id);
}

/* -------------------------------------------------------------------------- */
/* Statuses                                                                   */
/* -------------------------------------------------------------------------- */

/** A list's own status set, position-sorted (Requirement 3.1, 3.5). */
export function selectStatusesForList(
  state: FlowboardState,
  scope: Scope,
  listId: string,
): readonly Status[] {
  if (!canView(state, scope, listId)) return [];

  const statuses = Object.values(state.statuses).filter(
    (status) =>
      status.listId === listId && status.workspaceId === scope.workspaceId,
  );

  return sortByPosition(statuses);
}

/** The status a completed task moves to, resolved from the category table. */
export function selectTerminalStatus(
  state: FlowboardState,
  scope: Scope,
  listId: string,
): Status | undefined {
  return selectStatusesForList(state, scope, listId).find(
    (status) => status.category === TERMINAL_STATUS_CATEGORY,
  );
}

/**
 * The status in `toListId` that best corresponds to `fromStatusId`.
 *
 * Matches on category first, then falls back to the destination's first status.
 * The fallback is what Requirement 2.6 calls "remapped", and callers surface
 * that to the user rather than silently changing the task's state.
 */
export function selectRemappedStatus(
  state: FlowboardState,
  scope: Scope,
  fromStatusId: string,
  toListId: string,
): { status: Status | undefined; remapped: boolean } {
  const from = findStatus(state, fromStatusId);
  const candidates = selectStatusesForList(state, scope, toListId);

  if (!from) return { status: candidates[0], remapped: true };

  const sameCategory = candidates.find(
    (status) => status.category === from.category,
  );

  if (sameCategory) return { status: sameCategory, remapped: false };

  return { status: candidates[0], remapped: true };
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

/** Every task in a list the user may see, including subtasks. */
export function selectTasksForList(
  state: FlowboardState,
  scope: Scope,
  listId: string,
): readonly Task[] {
  if (!canView(state, scope, listId)) return [];

  return Object.values(state.tasks).filter(
    (task) =>
      task.primaryListId === listId && task.workspaceId === scope.workspaceId,
  );
}

/** Top-level tasks only — subtasks are rendered under their parent. */
export function selectTopLevelTasks(
  state: FlowboardState,
  scope: Scope,
  listId: string,
): readonly Task[] {
  return selectTasksForList(state, scope, listId).filter(
    (task) => task.parentTaskId === null,
  );
}

export function selectTask(
  state: FlowboardState,
  scope: Scope,
  taskId: string,
): Task | undefined {
  if (!canViewTask(state, scope, taskId)) return undefined;

  return findTask(state, taskId);
}

export function selectSubtasks(
  state: FlowboardState,
  scope: Scope,
  taskId: string,
): readonly Task[] {
  if (!canViewTask(state, scope, taskId)) return [];

  return subtasksOf(state, taskId);
}

/* -------------------------------------------------------------------------- */
/* Board                                                                      */
/* -------------------------------------------------------------------------- */

export interface BoardColumn {
  readonly status: Status;
  readonly tasks: readonly Task[];
  readonly count: number;
}

/**
 * The kanban board: one column per status in the list's own set, each holding
 * its top-level tasks in position order (Requirement 4.1).
 */
export function selectBoardColumns(
  state: FlowboardState,
  scope: Scope,
  listId: string,
): readonly BoardColumn[] {
  const tasks = selectTopLevelTasks(state, scope, listId);

  return selectStatusesForList(state, scope, listId).map((status) => {
    const columnTasks = sortByPosition(
      tasks.filter((task) => task.statusId === status.id),
    );

    return { status, tasks: columnTasks, count: columnTasks.length };
  });
}

/* -------------------------------------------------------------------------- */
/* List view                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Comparator for the list view.
 *
 * Priority reads `PRIORITY_CONFIG[p].rank`, so the semantic order is
 * guaranteed by configuration rather than restated here (Requirement 5.3,
 * 21.6). Due dates put nulls last in both directions (Requirement 5.4).
 */
export function compareTasks(
  state: FlowboardState,
  a: Task,
  b: Task,
  sort: SortState,
): number {
  switch (sort.field) {
    case "dueDate":
      return compareDueDate(a.dueDate, b.dueDate, sort.direction);

    case "priority":
      return comparePriority(a.priority, b.priority, sort.direction);

    case "title": {
      const delta = a.title.localeCompare(b.title);
      return sort.direction === "asc" ? delta : -delta;
    }

    case "status": {
      const aPos = findStatus(state, a.statusId)?.position ?? 0;
      const bPos = findStatus(state, b.statusId)?.position ?? 0;
      const delta = aPos - bPos;
      return sort.direction === "asc" ? delta : -delta;
    }

    default: {
      // Exhaustiveness: extending SortField becomes a compile error here
      // rather than a silent fall-through (Requirement 21.15).
      const exhaustive: never = sort.field;
      return exhaustive;
    }
  }
}

/** A row in the list view: a top-level task plus its subtasks. */
export interface TaskRow {
  readonly task: Task;
  readonly subtasks: readonly Task[];
}

export function selectTaskRows(
  state: FlowboardState,
  scope: Scope,
  listId: string,
  sort: SortState,
): readonly TaskRow[] {
  const topLevel = [...selectTopLevelTasks(state, scope, listId)].sort((a, b) =>
    compareTasks(state, a, b, sort),
  );

  return topLevel.map((task) => ({
    task,
    subtasks: subtasksOf(state, task.id),
  }));
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

/**
 * Offset pagination over in-memory rows (Requirement 9.12).
 *
 * `page` is zero-based and cumulative — page 1 returns the first two pages'
 * worth — because the list view's control is "load more" rather than numbered
 * pages, and re-rendering from zero keeps the selector pure.
 */
export function selectPaginatedRows(
  rows: readonly TaskRow[],
  page: number,
  pageSize: number = PAGE_SIZE,
): Page<TaskRow> {
  const end = (page + 1) * pageSize;

  return {
    items: rows.slice(0, end),
    total: rows.length,
    page,
    pageSize,
    hasMore: end < rows.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

/** Members of the scoped workspace, in seeded order. */
export function selectWorkspaceMembers(
  state: FlowboardState,
  scope: Scope,
): readonly User[] {
  return state.memberships
    .filter((membership) => membership.workspaceId === scope.workspaceId)
    .map((membership) => state.users[membership.userId])
    .filter((user): user is User => user !== undefined);
}

/** Resolves assignee ids to users, dropping any that no longer exist. */
export function selectAssignees(
  state: FlowboardState,
  assigneeIds: readonly string[],
): readonly User[] {
  return assigneeIds
    .map((id) => state.users[id])
    .filter((user): user is User => user !== undefined);
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

export interface SearchHit {
  readonly task: Task;
  readonly list: Container;
}

/**
 * Client-side search over title and description, scoped to the tasks the
 * current user may see (Requirement 23.2).
 */
export function selectSearchResults(
  state: FlowboardState,
  scope: Scope,
  query: string,
): readonly SearchHit[] {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) return [];

  const visibleListIds = new Set(
    selectVisibleLists(state, scope).map((list) => list.id),
  );

  return Object.values(state.tasks)
    .filter((task) => {
      if (task.workspaceId !== scope.workspaceId) return false;
      if (!visibleListIds.has(task.primaryListId)) return false;

      return (
        task.title.toLowerCase().includes(needle) ||
        (task.description?.toLowerCase().includes(needle) ?? false)
      );
    })
    .map((task) => {
      const list = findContainer(state, task.primaryListId);
      return list ? { task, list } : undefined;
    })
    .filter((hit): hit is SearchHit => hit !== undefined);
}

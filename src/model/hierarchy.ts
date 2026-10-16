import {
  CONTAINER_REGISTRY,
  canContain,
  type ContainerTypeConfig,
} from "@/config/containers";

import { sortByPosition } from "./position";
import { findContainer, type FlowboardState } from "./state";
import type { Container, Task } from "./types";

/**
 * Tree traversal.
 *
 * Every function here takes an optional registry so the hierarchy rules can be
 * swapped in tests. If any of this logic compared container types as literals,
 * adding a level would mean editing it; reading the registry means it does not
 * (Requirement 21.4).
 */

/** Guard against a malformed `parentId` chain looping forever. */
const MAX_CHAIN_DEPTH = 64;

/**
 * The chain from the workspace root down to `nodeId`, inclusive.
 *
 * Returns an empty array when the node does not exist or its chain is broken,
 * which the permission engine treats as "not visible" rather than throwing —
 * an orphaned node should fail closed.
 */
export function ancestorChain(
  state: FlowboardState,
  nodeId: string,
): Container[] {
  const chain: Container[] = [];
  let current = findContainer(state, nodeId);
  let guard = 0;

  while (current && guard < MAX_CHAIN_DEPTH) {
    chain.unshift(current);

    if (current.parentId === null) return chain;

    const parent = findContainer(state, current.parentId);

    // A node whose parent is missing is orphaned; fail closed.
    if (!parent) return [];

    current = parent;
    guard += 1;
  }

  /*
   * Reaching here means either the node did not exist, or the chain exceeded
   * MAX_CHAIN_DEPTH — which in practice means a `parentId` cycle. Both fail
   * closed: an empty chain denies visibility rather than throwing.
   */
  return [];
}

/** Ancestors of `nodeId`, excluding the node itself, root first. */
export function ancestorsOf(
  state: FlowboardState,
  nodeId: string,
): Container[] {
  return ancestorChain(state, nodeId).slice(0, -1);
}

/** Depth from the root. A workspace node is depth 0. */
export function depthOf(state: FlowboardState, nodeId: string): number {
  const chain = ancestorChain(state, nodeId);
  return chain.length === 0 ? -1 : chain.length - 1;
}

/** Direct children of `parentId`, position-sorted, live only by default. */
export function childContainers(
  state: FlowboardState,
  parentId: string,
  options: { includeArchived?: boolean } = {},
): Container[] {
  const children = Object.values(state.containers).filter(
    (container) =>
      container.parentId === parentId &&
      (options.includeArchived === true || container.archivedAt === null),
  );

  return sortByPosition(children);
}

/** Siblings of `nodeId` including itself, position-sorted. */
export function siblingsOf(
  state: FlowboardState,
  nodeId: string,
  options: { includeArchived?: boolean } = {},
): Container[] {
  const node = findContainer(state, nodeId);
  if (!node) return [];

  if (node.parentId === null) {
    const roots = Object.values(state.containers).filter(
      (container) =>
        container.parentId === null &&
        container.workspaceId === node.workspaceId,
    );
    return sortByPosition(roots);
  }

  return childContainers(state, node.parentId, options);
}

/** Every container beneath `nodeId`, excluding it, in breadth-first order. */
export function descendantContainers(
  state: FlowboardState,
  nodeId: string,
  options: { includeArchived?: boolean } = {},
): Container[] {
  const collected: Container[] = [];
  const queue = [nodeId];
  let guard = 0;

  while (queue.length > 0 && guard < MAX_CHAIN_DEPTH * 64) {
    const current = queue.shift();
    if (current === undefined) break;

    for (const child of childContainers(state, current, options)) {
      collected.push(child);
      queue.push(child.id);
    }

    guard += 1;
  }

  return collected;
}

/** True when `nodeId` sits anywhere beneath `ancestorId`. */
export function isDescendantOf(
  state: FlowboardState,
  nodeId: string,
  ancestorId: string,
): boolean {
  return ancestorsOf(state, nodeId).some(
    (ancestor) => ancestor.id === ancestorId,
  );
}

/**
 * Whether `childId` may be moved under `parentId`.
 *
 * Two separate rules: the registry must permit the type pairing, and the move
 * must not make a node its own ancestor (Requirement 1.2, 1.9).
 */
export function canMoveUnder(
  state: FlowboardState,
  childId: string,
  parentId: string,
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): boolean {
  const child = findContainer(state, childId);
  const parent = findContainer(state, parentId);

  if (!child || !parent) return false;
  if (child.id === parent.id) return false;
  if (child.workspaceId !== parent.workspaceId) return false;
  if (isDescendantOf(state, parent.id, child.id)) return false;

  return canContain(parent.type, child.type, registry);
}

/** The nesting depth of a task: 0 for a top-level task, 1 for a subtask. */
export function taskDepth(state: FlowboardState, taskId: string): number {
  let depth = 0;
  let current = state.tasks[taskId];
  let guard = 0;

  while (current?.parentTaskId != null && guard < MAX_CHAIN_DEPTH) {
    depth += 1;
    current = state.tasks[current.parentTaskId];
    guard += 1;
  }

  return depth;
}

/** Direct subtasks of `taskId`, position-sorted. */
export function subtasksOf(state: FlowboardState, taskId: string): Task[] {
  const subtasks = Object.values(state.tasks).filter(
    (task) => task.parentTaskId === taskId,
  );

  return sortByPosition(subtasks);
}

/** The container types that may be created inside `parentId`. */
export function creatableChildTypes(
  state: FlowboardState,
  parentId: string,
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): readonly string[] {
  const parent = findContainer(state, parentId);
  if (!parent) return [];

  return registry[parent.type]?.childTypes ?? [];
}

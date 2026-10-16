import {
  CONTAINER_REGISTRY,
  canContain,
  type ContainerTypeConfig,
} from "@/config/containers";
import {
  MAX_ASSIGNEES,
  MAX_NAME_LEN,
  MAX_TASK_DEPTH,
  MAX_TITLE_LEN,
} from "@/config/limits";
import { isPriority } from "@/config/priorities";

import { isDescendantOf, taskDepth } from "./hierarchy";
import type { AppError } from "./result";
import { findContainer, findStatus, findTask, type FlowboardState } from "./state";

/**
 * Field and structural validation.
 *
 * Every function returns `AppError | null` rather than throwing, so the
 * mutation pipeline can compose them with `??` and return the first problem
 * (Requirement 10.6). `field` is populated wherever a specific input is at
 * fault, which is what lets the task drawer attach the message to the exact
 * control (Requirement 2.4).
 */

function invalid(message: string, field?: string): AppError {
  return field === undefined
    ? { code: "VALIDATION", message }
    : { code: "VALIDATION", message, field };
}

function notFound(message: string): AppError {
  return { code: "NOT_FOUND", message };
}

/* -------------------------------------------------------------------------- */
/* Fields                                                                     */
/* -------------------------------------------------------------------------- */

export function validateContainerName(name: string): AppError | null {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return invalid("Name is required.", "name");
  }

  if (trimmed.length > MAX_NAME_LEN) {
    return invalid(
      `Name must be ${String(MAX_NAME_LEN)} characters or fewer.`,
      "name",
    );
  }

  return null;
}

export function validateTaskTitle(title: string): AppError | null {
  const trimmed = title.trim();

  if (trimmed.length === 0) {
    return invalid("Title is required.", "title");
  }

  if (trimmed.length > MAX_TITLE_LEN) {
    return invalid(
      `Title must be ${String(MAX_TITLE_LEN)} characters or fewer.`,
      "title",
    );
  }

  return null;
}

export function validatePriority(priority: unknown): AppError | null {
  if (!isPriority(priority)) {
    return invalid("Unknown priority.", "priority");
  }

  return null;
}

/**
 * Due dates are stored as ISO datetimes. A string that `Date` cannot parse
 * would otherwise become `Invalid Date` and silently sort to the end.
 */
export function validateDueDate(dueDate: string | null): AppError | null {
  if (dueDate === null) return null;

  const parsed = new Date(dueDate);

  if (Number.isNaN(parsed.getTime())) {
    return invalid("Due date is not a valid date.", "dueDate");
  }

  return null;
}

export function validateAssignees(
  state: FlowboardState,
  workspaceId: string,
  assigneeIds: readonly string[],
): AppError | null {
  if (assigneeIds.length > MAX_ASSIGNEES) {
    return invalid(
      `A task can have at most ${String(MAX_ASSIGNEES)} assignees.`,
      "assigneeIds",
    );
  }

  if (new Set(assigneeIds).size !== assigneeIds.length) {
    return invalid("Assignees must be unique.", "assigneeIds");
  }

  const members = new Set(
    state.memberships
      .filter((membership) => membership.workspaceId === workspaceId)
      .map((membership) => membership.userId),
  );

  for (const userId of assigneeIds) {
    if (!members.has(userId)) {
      return invalid(
        "Assignee is not a member of this workspace.",
        "assigneeIds",
      );
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Structure                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Whether `childType` may be created inside `parentType`.
 *
 * Reads `canContain` rather than matching on type pairs, so adding a hierarchy
 * level requires no change here (Requirement 1.2, 21.4).
 */
export function validateParentType(
  parentType: string,
  childType: string,
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): AppError | null {
  if (!canContain(parentType, childType, registry)) {
    const parentLabel = registry[parentType]?.label ?? parentType;
    const childLabel = registry[childType]?.labelPlural ?? childType;

    return invalid(`A ${parentLabel.toLowerCase()} cannot contain ${childLabel.toLowerCase()}.`);
  }

  return null;
}

/** Rejects a move that would make a node its own ancestor (Requirement 1.9). */
export function validateNoCycle(
  state: FlowboardState,
  nodeId: string,
  newParentId: string,
): AppError | null {
  if (nodeId === newParentId) {
    return invalid("A node cannot be moved into itself.");
  }

  if (isDescendantOf(state, newParentId, nodeId)) {
    return invalid("A node cannot be moved into one of its own descendants.");
  }

  return null;
}

/**
 * Validates a container move in full: both nodes exist, same workspace, the
 * registry permits the pairing, and no cycle results.
 */
export function validateContainerMove(
  state: FlowboardState,
  nodeId: string,
  newParentId: string,
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): AppError | null {
  const node = findContainer(state, nodeId);
  const parent = findContainer(state, newParentId);

  if (!node) return notFound("That item no longer exists.");
  if (!parent) return notFound("The destination no longer exists.");

  if (node.workspaceId !== parent.workspaceId) {
    return invalid("Items cannot be moved between workspaces.");
  }

  return (
    validateParentType(parent.type, node.type, registry) ??
    validateNoCycle(state, nodeId, newParentId)
  );
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A task may only use a status defined on its own list (Requirement 2.5, 3.5).
 */
export function validateStatusBelongsToList(
  state: FlowboardState,
  statusId: string,
  listId: string,
): AppError | null {
  const status = findStatus(state, statusId);

  if (!status) {
    return notFound("That status no longer exists.");
  }

  if (status.listId !== listId) {
    return invalid(
      "That status belongs to a different list.",
      "statusId",
    );
  }

  return null;
}

/**
 * Subtask depth.
 *
 * Compares `taskDepth(parent) + 1` against `MAX_TASK_DEPTH` rather than
 * checking `parentTaskId === null`. Identical behaviour at depth 1, but raising
 * the limit becomes a constant change instead of rewriting a check that only
 * ever understood two levels (Requirement 2.11, 21.9).
 */
export function validateSubtaskDepth(
  state: FlowboardState,
  parentTaskId: string | null,
): AppError | null {
  if (parentTaskId === null) return null;

  const parent = findTask(state, parentTaskId);

  if (!parent) {
    return notFound("The parent task no longer exists.");
  }

  const resultingDepth = taskDepth(state, parentTaskId) + 1;

  if (resultingDepth > MAX_TASK_DEPTH) {
    return invalid(
      MAX_TASK_DEPTH === 1
        ? "Subtasks cannot have their own subtasks."
        : `Tasks can be nested at most ${String(MAX_TASK_DEPTH)} levels deep.`,
    );
  }

  return null;
}

/** A subtask must live in the same list as its parent (Requirement 2.7). */
export function validateSubtaskList(
  state: FlowboardState,
  parentTaskId: string | null,
  listId: string,
): AppError | null {
  if (parentTaskId === null) return null;

  const parent = findTask(state, parentTaskId);

  if (!parent) {
    return notFound("The parent task no longer exists.");
  }

  if (parent.primaryListId !== listId) {
    return invalid("A subtask must be in the same list as its parent.");
  }

  return null;
}

/** The target of a task operation must be a container that holds tasks. */
export function validateListHoldsTasks(
  state: FlowboardState,
  listId: string,
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): AppError | null {
  const list = findContainer(state, listId);

  if (!list) return notFound("That list no longer exists.");
  if (list.archivedAt !== null) return notFound("That list has been archived.");

  if (registry[list.type]?.holdsTasks !== true) {
    const label = registry[list.type]?.label ?? list.type;
    return invalid(`Tasks cannot be added to a ${label.toLowerCase()}.`);
  }

  return null;
}

import { nanoid } from "nanoid";

import { DEFAULT_PRIORITY } from "@/config/priorities";
import { subtasksOf, taskDepth } from "@/model/hierarchy";
import { requireCapability, requireTaskCapability } from "@/model/permissions";
import { positionForIndex, sortByPosition } from "@/model/position";
import type { AppError, Result } from "@/model/result";
import {
  selectRemappedStatus,
  selectStatusesForList,
  selectTerminalStatus,
} from "@/model/selectors";
import {
  findStatus,
  findTask,
  type MutableFlowboardState,
} from "@/model/state";
import type { Scope, Task } from "@/model/types";
import {
  validateAssignees,
  validateDueDate,
  validateListHoldsTasks,
  validateStatusBelongsToList,
  validateSubtaskDepth,
  validateSubtaskList,
  validateTaskTitle,
} from "@/model/validation";

import { firstError, runMutation } from "../pipeline";

import type { MoveTaskResult, SliceContext, TaskActions } from "./types";

/**
 * Task CRUD, status changes, reordering and cross-list moves.
 *
 * Members may do all of this in lists they can see; none of it is admin-gated
 * (Requirement 8.9). `move` is the one optimistic action in the app.
 */
export function createTaskSlice(context: SliceContext): TaskActions {
  const pipeline = {
    transport: context.deps.transport,
    getState: context.getState,
    setState: context.setState,
  };

  function touch(draft: MutableFlowboardState, task: Task): Task {
    const updated: Task = { ...task, updatedAt: new Date().toISOString() };
    draft.tasks[task.id] = updated;
    return updated;
  }

  /** Tasks in a status column, excluding one id, position-sorted. */
  function columnTasks(
    draft: MutableFlowboardState,
    statusId: string,
    excludeId?: string,
  ): Task[] {
    return sortByPosition(
      Object.values(draft.tasks).filter(
        (task) =>
          task.statusId === statusId &&
          task.parentTaskId === null &&
          task.id !== excludeId,
      ),
    );
  }

  return {
    create: (scope: Scope, input): Promise<Result<Task>> =>
      runMutation(pipeline, {
        validate: (state): AppError | null => {
          const listError = validateListHoldsTasks(state, input.listId);

          if (listError) return listError;

          const statuses = selectStatusesForList(state, scope, input.listId);
          const statusId = input.statusId ?? statuses[0]?.id;

          if (statusId === undefined) {
            return {
              code: "CONFLICT",
              message: "That list has no statuses to add a task to.",
            };
          }

          return firstError(
            validateTaskTitle(input.title),
            validateStatusBelongsToList(state, statusId, input.listId),
            validateDueDate(input.dueDate ?? null),
            validateAssignees(
              state,
              scope.workspaceId,
              input.assigneeIds ?? [],
            ),
            validateSubtaskDepth(state, input.parentTaskId ?? null),
            validateSubtaskList(
              state,
              input.parentTaskId ?? null,
              input.listId,
            ),
          );
        },
        authorize: (state) =>
          requireCapability(state, scope, "task:create", input.listId),
        apply: (draft) => {
          const statuses = sortByPosition(
            Object.values(draft.statuses).filter(
              (status) => status.listId === input.listId,
            ),
          );

          const statusId = input.statusId ?? statuses[0]?.id ?? "";
          const now = new Date().toISOString();

          const siblings =
            input.parentTaskId == null
              ? columnTasks(draft, statusId)
              : subtasksOf(
                  { ...context.getState(), tasks: draft.tasks },
                  input.parentTaskId,
                );

          const created: Task = {
            id: `t-${nanoid(8)}`,
            workspaceId: scope.workspaceId,
            primaryListId: input.listId,
            parentTaskId: input.parentTaskId ?? null,
            title: input.title.trim(),
            description: input.description ?? null,
            statusId,
            priority: input.priority ?? DEFAULT_PRIORITY,
            assigneeIds: [...(input.assigneeIds ?? [])],
            dueDate: input.dueDate ?? null,
            position: positionForIndex(siblings, siblings.length),
            createdAt: now,
            updatedAt: now,
          };

          draft.tasks[created.id] = created;

          return created;
        },
      }),

    update: (scope, taskId, input): Promise<Result<Task>> =>
      runMutation(pipeline, {
        validate: (state): AppError | null => {
          const task = findTask(state, taskId);

          if (!task) {
            return {
              code: "NOT_FOUND",
              message: "That task no longer exists.",
            };
          }

          return firstError(
            input.title === undefined ? null : validateTaskTitle(input.title),
            input.statusId === undefined
              ? null
              : validateStatusBelongsToList(
                  state,
                  input.statusId,
                  task.primaryListId,
                ),
            input.dueDate === undefined ? null : validateDueDate(input.dueDate),
            input.assigneeIds === undefined
              ? null
              : validateAssignees(state, scope.workspaceId, input.assigneeIds),
          );
        },
        authorize: (state) =>
          requireTaskCapability(state, scope, "task:update", taskId),
        apply: (draft) => {
          const existing = draft.tasks[taskId];

          if (!existing) throw new Error("Task vanished mid-mutation");

          /*
           * A status change moves the task to a different column, so its
           * position has to be recomputed — leaving it would drop the card at
           * an arbitrary point in the destination.
           */
          const movedColumn =
            input.statusId !== undefined &&
            input.statusId !== existing.statusId;

          const position = movedColumn
            ? positionForIndex(
                columnTasks(draft, input.statusId ?? existing.statusId, taskId),
                Number.MAX_SAFE_INTEGER,
              )
            : existing.position;

          const updated: Task = {
            ...existing,
            ...(input.title === undefined ? {} : { title: input.title.trim() }),
            ...(input.description === undefined
              ? {}
              : { description: input.description }),
            ...(input.statusId === undefined
              ? {}
              : { statusId: input.statusId }),
            ...(input.priority === undefined
              ? {}
              : { priority: input.priority }),
            ...(input.assigneeIds === undefined
              ? {}
              : { assigneeIds: [...input.assigneeIds] }),
            ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
            position,
            updatedAt: new Date().toISOString(),
          };

          draft.tasks[taskId] = updated;

          return updated;
        },
      }),

    /**
     * Hard delete, cascading to subtasks.
     *
     * Containers archive; tasks delete. Tombstoned tasks would complicate every
     * selector for little demo value, and the cascade count is surfaced in the
     * confirm dialog so the consequence is stated before it happens
     * (Requirement 2.3, 2.12).
     */
    remove: (scope, taskId) =>
      runMutation(pipeline, {
        validate: (state): AppError | null =>
          findTask(state, taskId)
            ? null
            : { code: "NOT_FOUND", message: "That task no longer exists." },
        authorize: (state) =>
          requireTaskCapability(state, scope, "task:delete", taskId),
        apply: (draft) => {
          const children = Object.values(draft.tasks)
            .filter((task) => task.parentTaskId === taskId)
            .map((task) => task.id);

          const deletedIds = [taskId, ...children];

          for (const id of deletedIds) {
            delete draft.tasks[id];
          }

          return { deletedIds };
        },
      }),

    /**
     * The optimistic action.
     *
     * Applies immediately so the card lands under the cursor, then awaits the
     * transport and restores the exact pre-drag ordering if it fails
     * (Requirement 4.8, 9.10, 14.12).
     */
    move: (scope, input): Promise<Result<MoveTaskResult>> =>
      runMutation(pipeline, {
        optimistic: true,
        validate: (state): AppError | null => {
          const task = findTask(state, input.taskId);

          if (!task) {
            return {
              code: "NOT_FOUND",
              message: "That task no longer exists.",
            };
          }

          const status = findStatus(state, input.toStatusId);

          if (!status) {
            return {
              code: "NOT_FOUND",
              message: "That status no longer exists.",
            };
          }

          // A subtask must stay in its parent's list, so it cannot be dragged
          // into another list's column.
          if (
            task.parentTaskId !== null &&
            status.listId !== task.primaryListId
          ) {
            return {
              code: "VALIDATION",
              message: "A subtask cannot be moved to another list.",
            };
          }

          return validateListHoldsTasks(state, status.listId);
        },
        authorize: (state) => {
          const status = findStatus(state, input.toStatusId);

          return firstError(
            requireTaskCapability(state, scope, "task:reorder", input.taskId),
            status === undefined
              ? null
              : requireCapability(state, scope, "task:update", status.listId),
          );
        },
        apply: (draft) => {
          const existing = draft.tasks[input.taskId];
          const status = draft.statuses[input.toStatusId];

          if (!existing || !status) {
            throw new Error("Task or status vanished mid-mutation");
          }

          const crossesList = status.listId !== existing.primaryListId;

          const updated: Task = {
            ...existing,
            statusId: status.id,
            primaryListId: status.listId,
            position: positionForIndex(
              columnTasks(draft, status.id, input.taskId),
              input.toIndex,
            ),
            updatedAt: new Date().toISOString(),
          };

          draft.tasks[input.taskId] = updated;

          // Subtasks follow their parent, preserving the same-list invariant
          // (Requirement 2.7).
          if (crossesList) {
            for (const subtask of Object.values(draft.tasks)) {
              if (subtask.parentTaskId !== input.taskId) continue;

              const remapped = sortByPosition(
                Object.values(draft.statuses).filter(
                  (candidate) => candidate.listId === status.listId,
                ),
              );

              const target =
                remapped.find(
                  (candidate) =>
                    candidate.category ===
                    draft.statuses[subtask.statusId]?.category,
                ) ?? remapped[0];

              draft.tasks[subtask.id] = {
                ...subtask,
                primaryListId: status.listId,
                statusId: target?.id ?? status.id,
                updatedAt: new Date().toISOString(),
              };
            }
          }

          return { task: updated, statusRemapped: false };
        },
      }),

    moveToList: (scope, taskId, toListId): Promise<Result<MoveTaskResult>> =>
      runMutation(pipeline, {
        validate: (state): AppError | null => {
          const task = findTask(state, taskId);

          if (!task) {
            return {
              code: "NOT_FOUND",
              message: "That task no longer exists.",
            };
          }

          if (task.parentTaskId !== null) {
            return {
              code: "VALIDATION",
              message: "Move the parent task instead.",
            };
          }

          if (task.primaryListId === toListId) {
            return {
              code: "CONFLICT",
              message: "That task is already in this list.",
            };
          }

          return validateListHoldsTasks(state, toListId);
        },
        authorize: (state) =>
          firstError(
            requireTaskCapability(state, scope, "task:update", taskId),
            requireCapability(state, scope, "task:create", toListId),
          ),
        apply: (draft) => {
          const existing = draft.tasks[taskId];

          if (!existing) throw new Error("Task vanished mid-mutation");

          const { status, remapped } = selectRemappedStatus(
            { ...context.getState(), statuses: draft.statuses },
            scope,
            existing.statusId,
            toListId,
          );

          if (!status) {
            throw new Error("Destination list has no statuses");
          }

          const now = new Date().toISOString();

          const updated: Task = {
            ...existing,
            primaryListId: toListId,
            statusId: status.id,
            position: positionForIndex(
              columnTasks(draft, status.id, taskId),
              Number.MAX_SAFE_INTEGER,
            ),
            updatedAt: now,
          };

          draft.tasks[taskId] = updated;

          for (const subtask of Object.values(draft.tasks)) {
            if (subtask.parentTaskId !== taskId) continue;

            const subStatuses = sortByPosition(
              Object.values(draft.statuses).filter(
                (candidate) => candidate.listId === toListId,
              ),
            );

            const target =
              subStatuses.find(
                (candidate) =>
                  candidate.category ===
                  draft.statuses[subtask.statusId]?.category,
              ) ?? subStatuses[0];

            draft.tasks[subtask.id] = {
              ...subtask,
              primaryListId: toListId,
              statusId: target?.id ?? status.id,
              updatedAt: now,
            };
          }

          return { task: updated, statusRemapped: remapped };
        },
      }),

    /** The card checkbox: moves a task to its list's terminal status. */
    toggleComplete: (scope, taskId): Promise<Result<Task>> =>
      runMutation(pipeline, {
        validate: (state): AppError | null => {
          const task = findTask(state, taskId);

          if (!task) {
            return {
              code: "NOT_FOUND",
              message: "That task no longer exists.",
            };
          }

          const terminal = selectTerminalStatus(
            state,
            scope,
            task.primaryListId,
          );

          return terminal
            ? null
            : {
                code: "CONFLICT",
                message: "That list has no completed status.",
              };
        },
        authorize: (state) =>
          requireTaskCapability(state, scope, "task:update", taskId),
        apply: (draft) => {
          const existing = draft.tasks[taskId];

          if (!existing) throw new Error("Task vanished mid-mutation");

          const listStatuses = sortByPosition(
            Object.values(draft.statuses).filter(
              (status) => status.listId === existing.primaryListId,
            ),
          );

          const terminal = listStatuses.find(
            (status) => status.category === "done",
          );
          const current = draft.statuses[existing.statusId];

          if (!terminal) throw new Error("No terminal status");

          /*
           * Unchecking returns the task to the first non-terminal status rather
           * than to whatever it held before. Remembering the previous status
           * would mean storing it, and "uncheck returns it to the start of the
           * workflow" is the behaviour users expect from a checkbox.
           */
          const target =
            current?.category === "done"
              ? (listStatuses.find((status) => status.category !== "done") ??
                terminal)
              : terminal;

          return touch(draft, {
            ...existing,
            statusId: target.id,
            position: positionForIndex(
              columnTasks(draft, target.id, taskId),
              Number.MAX_SAFE_INTEGER,
            ),
          });
        },
      }),

    duplicate: (scope, taskId): Promise<Result<Task>> =>
      runMutation(pipeline, {
        validate: (state): AppError | null =>
          findTask(state, taskId)
            ? null
            : { code: "NOT_FOUND", message: "That task no longer exists." },
        authorize: (state) =>
          requireTaskCapability(state, scope, "task:create", taskId),
        apply: (draft) => {
          const source = draft.tasks[taskId];

          if (!source) throw new Error("Task vanished mid-mutation");

          const now = new Date().toISOString();
          const siblings = columnTasks(draft, source.statusId);

          const copy: Task = {
            ...source,
            id: `t-${nanoid(8)}`,
            title: `${source.title} (copy)`,
            position: positionForIndex(siblings, siblings.length),
            createdAt: now,
            updatedAt: now,
          };

          draft.tasks[copy.id] = copy;

          // Subtasks are copied too, keeping depth and list invariants intact.
          for (const subtask of subtasksOf(
            { ...context.getState(), tasks: draft.tasks },
            taskId,
          )) {
            if (
              taskDepth(
                { ...context.getState(), tasks: draft.tasks },
                subtask.id,
              ) > 1
            ) {
              continue;
            }

            const subCopy: Task = {
              ...subtask,
              id: `t-${nanoid(8)}`,
              parentTaskId: copy.id,
              createdAt: now,
              updatedAt: now,
            };

            draft.tasks[subCopy.id] = subCopy;
          }

          return copy;
        },
      }),
  };
}

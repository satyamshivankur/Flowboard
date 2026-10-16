import { useCallback, useMemo } from "react";

import { PRIORITY_CONFIG, type Priority } from "@/config/priorities";
import { formatRelative } from "@/lib/date";
import type { Result } from "@/model/result";
import {
  selectAssignees,
  selectBreadcrumb,
  selectStatusesForList,
  selectSubtasks,
  selectTask,
  selectVisibleLists,
  selectWorkspaceMembers,
} from "@/model/selectors";

import type { MoveTaskResult, UpdateTaskInput } from "../slices/types";
import { useStore } from "../store";

import { usePermissions } from "./usePermissions";
import { useScope } from "./useScope";

export interface DrawerStatusOption {
  readonly id: string;
  readonly name: string;
  readonly colorToken: string;
}

export interface DrawerSubtask {
  readonly id: string;
  readonly title: string;
  readonly isComplete: boolean;
}

export interface DrawerViewModel {
  readonly exists: boolean;
  readonly taskId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly statusId: string;
  readonly priority: Priority;
  readonly priorityLabel: string;
  readonly assigneeIds: readonly string[];
  readonly dueDate: string | null;
  readonly listId: string;
  readonly breadcrumb: readonly { id: string; name: string }[];
  readonly createdLabel: string;
  readonly updatedLabel: string;
  readonly statuses: readonly DrawerStatusOption[];
  readonly members: readonly {
    id: string;
    name: string;
    avatarToken: string;
  }[];
  readonly assignees: readonly {
    id: string;
    name: string;
    avatarToken: string;
  }[];
  readonly subtasks: readonly DrawerSubtask[];
  readonly moveTargets: readonly { id: string; name: string }[];
  /** False when the user may view but not edit — the drawer renders read-only. */
  readonly canEdit: boolean;
  readonly readOnlyReason: string | undefined;
  readonly onFieldSave: (input: UpdateTaskInput) => Promise<Result<unknown>>;
  readonly onMoveToList: (toListId: string) => Promise<Result<MoveTaskResult>>;
  readonly onDelete: () => Promise<
    Result<{ readonly deletedIds: readonly string[] }>
  >;
  readonly onAddSubtask: (title: string) => Promise<Result<unknown>>;
  readonly onToggleSubtask: (subtaskId: string) => Promise<Result<unknown>>;
  readonly onDeleteSubtask: (
    subtaskId: string,
  ) => Promise<Result<{ readonly deletedIds: readonly string[] }>>;
  /** Subtask count, so the confirm dialog can state the cascade. */
  readonly cascadeCount: number;
}

const EMPTY_DRAWER: Omit<
  DrawerViewModel,
  | "onFieldSave"
  | "onMoveToList"
  | "onDelete"
  | "onAddSubtask"
  | "onToggleSubtask"
  | "onDeleteSubtask"
> = {
  exists: false,
  taskId: null,
  title: "",
  description: null,
  statusId: "",
  priority: "none",
  priorityLabel: "None",
  assigneeIds: [],
  dueDate: null,
  listId: "",
  breadcrumb: [],
  createdLabel: "",
  updatedLabel: "",
  statuses: [],
  members: [],
  assignees: [],
  subtasks: [],
  moveTargets: [],
  canEdit: false,
  readOnlyReason: undefined,
  cascadeCount: 0,
};

/**
 * The task drawer.
 *
 * Resolves everything the drawer renders, including the read-only state. When
 * the user lacks `task:update`, `canEdit` is false and the drawer disables its
 * controls up front rather than letting a submit fail — a disabled field
 * explains itself, a rejected save does not (Requirement 7.10).
 */
export function useTaskDrawer(
  taskId: string | null,
  now: string = new Date().toISOString(),
): DrawerViewModel {
  const scope = useScope();
  const actions = useStore((state) => state.actions.task);
  const permissions = usePermissions();

  /*
   * Derived in `useMemo` from the whole store — see the note in
   * `useVisibleTree` for why a mapping `useShallow` selector loops.
   */
  const state = useStore();

  const data = useMemo(() => {
    {
      if (taskId === null) return null;

      const task = selectTask(state, scope, taskId);

      if (!task) return null;

      const statuses = selectStatusesForList(
        state,
        scope,
        task.primaryListId,
      ).map((status) => ({
        id: status.id,
        name: status.name,
        colorToken: status.color,
      }));

      const subtasks = selectSubtasks(state, scope, task.id).map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        isComplete: state.statuses[subtask.statusId]?.category === "done",
      }));

      return {
        task,
        statuses,
        subtasks,
        breadcrumb: selectBreadcrumb(state, scope, task.primaryListId).map(
          (node) => ({ id: node.id, name: node.name }),
        ),
        members: selectWorkspaceMembers(state, scope).map((user) => ({
          id: user.id,
          name: user.name,
          avatarToken: user.avatarToken,
        })),
        assignees: selectAssignees(state, task.assigneeIds).map((user) => ({
          id: user.id,
          name: user.name,
          avatarToken: user.avatarToken,
        })),
        moveTargets: selectVisibleLists(state, scope)
          .filter((list) => list.id !== task.primaryListId)
          .map((list) => ({ id: list.id, name: list.name })),
      };
    }
  }, [state, scope, taskId]);

  const onFieldSave = useCallback(
    (input: UpdateTaskInput) => actions.update(scope, taskId ?? "", input),
    [actions, scope, taskId],
  );

  const onMoveToList = useCallback(
    (toListId: string) => actions.moveToList(scope, taskId ?? "", toListId),
    [actions, scope, taskId],
  );

  const onDelete = useCallback(
    () => actions.remove(scope, taskId ?? ""),
    [actions, scope, taskId],
  );

  const onAddSubtask = useCallback(
    (title: string) =>
      actions.create(scope, {
        listId: data?.task.primaryListId ?? "",
        title,
        parentTaskId: taskId,
      }),
    [actions, scope, taskId, data],
  );

  const onToggleSubtask = useCallback(
    (subtaskId: string) => actions.toggleComplete(scope, subtaskId),
    [actions, scope],
  );

  const onDeleteSubtask = useCallback(
    (subtaskId: string) => actions.remove(scope, subtaskId),
    [actions, scope],
  );

  return useMemo(() => {
    const callbacks = {
      onFieldSave,
      onMoveToList,
      onDelete,
      onAddSubtask,
      onToggleSubtask,
      onDeleteSubtask,
    };

    if (!data) return { ...EMPTY_DRAWER, ...callbacks };

    const canEdit = permissions.can("task:update", data.task.primaryListId);

    return {
      ...callbacks,
      exists: true,
      taskId: data.task.id,
      title: data.task.title,
      description: data.task.description,
      statusId: data.task.statusId,
      priority: data.task.priority,
      priorityLabel: PRIORITY_CONFIG[data.task.priority].label,
      assigneeIds: data.task.assigneeIds,
      dueDate: data.task.dueDate,
      listId: data.task.primaryListId,
      breadcrumb: data.breadcrumb,
      createdLabel: formatRelative(data.task.createdAt, now),
      updatedLabel: formatRelative(data.task.updatedAt, now),
      statuses: data.statuses,
      members: data.members,
      assignees: data.assignees,
      subtasks: data.subtasks,
      moveTargets: data.moveTargets,
      canEdit,
      readOnlyReason: canEdit
        ? undefined
        : permissions.reasonFor("task:update", data.task.primaryListId),
      cascadeCount: data.subtasks.length,
    };
  }, [
    data,
    permissions,
    now,
    onFieldSave,
    onMoveToList,
    onDelete,
    onAddSubtask,
    onToggleSubtask,
    onDeleteSubtask,
  ]);
}

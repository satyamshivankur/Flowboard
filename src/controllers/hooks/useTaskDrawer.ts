import { useCallback, useMemo } from "react";

import type { AvatarColorToken } from "@/config/avatars";
import { PRIORITY_CONFIG, type Priority } from "@/config/priorities";
import type { StatusColorToken } from "@/config/statusCategories";
import { formatRelative } from "@/lib/date";
import type { Result } from "@/model/result";
import {
  selectAssignees,
  selectBreadcrumb,
  selectEditableLists,
  selectStatusesForList,
  selectSubtasks,
  selectTask,
  selectWorkspaceMembers,
} from "@/model/selectors";

import type { MoveTaskResult, UpdateTaskInput } from "../slices/types";
import { useStore } from "../store";

/*
 * Re-exported so a View can type a field-save payload without reaching into
 * `controllers/slices`, which the boundary lint forbids — correctly: the slice
 * module is the Controller's internals, and a hook is its public surface.
 */
export type { UpdateTaskInput };

import { buildTaskCard, type TaskCardViewModel } from "./useBoard";
import { usePermissions } from "./usePermissions";
import { useScope } from "./useScope";

export interface DrawerStatusOption {
  readonly id: string;
  readonly name: string;
  /** Token, not a class — `StatusPill` resolves it through the shared map. */
  readonly colorToken: StatusColorToken;
}

/** A workspace member, reduced to what an avatar and a picker need. */
export interface DrawerMember {
  readonly id: string;
  readonly name: string;
  readonly avatarToken: AvatarColorToken;
}

/**
 * A subtask row in the drawer.
 *
 * The board's card view-model rather than a shape of its own. The drawer's
 * subtask rows carry the same inline controls as the list view's nested rows
 * (Requirement 7.4.1), and those read `statusId`, `priority`, `dueDate` and
 * resolved `assignees` — every one of which `buildTaskCard` already computes
 * for the board and the table.
 *
 * It was `{ id, title, isComplete }`, which is why the drawer could only tick
 * and delete a subtask. Widening it by hand would have made a fourth bespoke
 * shape for one task's display state; reusing the existing one means a change
 * to how a due date or an avatar resolves lands on all three surfaces at once
 * (Requirement 13.6, 21.17).
 */
export type DrawerSubtask = TaskCardViewModel;

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
  readonly members: readonly DrawerMember[];
  readonly assignees: readonly DrawerMember[];
  readonly subtasks: readonly DrawerSubtask[];
  readonly moveTargets: readonly { id: string; name: string }[];
  /** False when the user may view but not edit — the drawer renders read-only. */
  readonly canEdit: boolean;
  readonly readOnlyReason: string | undefined;
  readonly onFieldSave: (input: UpdateTaskInput) => Promise<Result<unknown>>;
  /** Writes one field of a subtask, by id — `onFieldSave` only edits the parent. */
  readonly onSubtaskUpdate: (
    subtaskId: string,
    input: UpdateTaskInput,
  ) => Promise<Result<unknown>>;
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
  | "onSubtaskUpdate"
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

      const subtasks = selectSubtasks(state, scope, task.id).map((subtask) =>
        buildTaskCard(state, subtask, now),
      );

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
        moveTargets: selectEditableLists(state, scope)
          .filter((list) => list.id !== task.primaryListId)
          .map((list) => ({ id: list.id, name: list.name })),
      };
    }
    /*
     * `now` is a dependency because `buildTaskCard` resolves the overdue tone
     * against it. That makes a stable reference time the caller's
     * responsibility — `TaskDrawer` fixes one at mount, as the board and the
     * list view already do. A fresh `Date.now()` per render would re-run every
     * selector in here on every render.
     */
  }, [state, scope, taskId, now]);

  const onFieldSave = useCallback(
    (input: UpdateTaskInput) => actions.update(scope, taskId ?? "", input),
    [actions, scope, taskId],
  );

  /**
   * Writes one field of a subtask.
   *
   * Separate from `onFieldSave`, which closes over the open task's id and so
   * could only ever edit the parent. Mirrors `useTaskTable.onQuickUpdate`
   * deliberately: the drawer's subtask rows and the table's nested rows are
   * now the same editing surface, and they should not reach the Controller by
   * two differently-shaped routes (Requirement 7.4.1).
   */
  const onSubtaskUpdate = useCallback(
    (subtaskId: string, input: UpdateTaskInput) =>
      actions.update(scope, subtaskId, input),
    [actions, scope],
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
      onSubtaskUpdate,
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
    onSubtaskUpdate,
    onMoveToList,
    onDelete,
    onAddSubtask,
    onToggleSubtask,
    onDeleteSubtask,
  ]);
}

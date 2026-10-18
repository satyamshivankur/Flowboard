import { useCallback, useMemo } from "react";

import type { AvatarColorToken } from "@/config/avatars";
import { MAX_TASK_DEPTH } from "@/config/limits";
import { PRIORITY_CONFIG, type Priority } from "@/config/priorities";
import type { StatusColorToken } from "@/config/statusCategories";
import { dueDateTone, type DueDateTone } from "@/lib/date";
import { subtasksOf } from "@/model/hierarchy";
import { can } from "@/model/permissions";
import type { Result } from "@/model/result";
import {
  selectAssignees,
  selectBoardColumns,
  selectEditableLists,
  selectWorkspaceMembers,
} from "@/model/selectors";

import type { MoveTaskResult, UpdateTaskInput } from "../slices/types";
import { useStore } from "../store";

import { usePermissions } from "./usePermissions";
import { useScope } from "./useScope";

/** An assignee reduced to what an avatar needs. */
export interface AssigneeViewModel {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  /** Token, not a class — `Avatar` resolves it through the shared map. */
  readonly avatarToken: AvatarColorToken;
}

/** A task card's props, with every display decision already resolved. */
export interface TaskCardViewModel {
  readonly id: string;
  /** The task's current status, so a quick-change menu can exclude it. */
  readonly statusId: string;
  readonly title: string;
  readonly priority: Priority;
  readonly priorityLabel: string;
  readonly priorityToken: string;
  readonly dueDate: string | null;
  readonly dueDateTone: DueDateTone;
  readonly assignees: readonly AssigneeViewModel[];
  /**
   * This task's children, as full card view-models.
   *
   * Nested rather than counted, so the board can render and edit a subtask
   * with the same controls as its parent instead of sending the user to the
   * drawer to change one field — which is what the list view's table has
   * always done (Requirement 5.7, 15.10).
   *
   * `subtaskCount` and `completedSubtaskCount` are derived from this array, so
   * the badge and the rows it summarises cannot disagree.
   */
  readonly subtasks: readonly TaskCardViewModel[];
  readonly subtaskCount: number;
  readonly completedSubtaskCount: number;
  readonly isComplete: boolean;
  readonly hasDescription: boolean;
}

export interface BoardColumnViewModel {
  readonly statusId: string;
  readonly name: string;
  readonly colorToken: StatusColorToken;
  readonly count: number;
  readonly tasks: readonly TaskCardViewModel[];
}

export interface BoardViewModel {
  readonly columns: readonly BoardColumnViewModel[];
  readonly isLoading: boolean;
  readonly isEmpty: boolean;
  readonly canEdit: boolean;
  /**
   * Why editing is refused, or undefined when it is not. A disabled control
   * that cannot say why is a dead end (Requirement 8.11, 17.2).
   */
  readonly readOnlyReason: string | undefined;
  /** Other lists this user may move a task into. */
  readonly moveTargets: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  /**
   * Workspace members, so a card can assign without opening the drawer.
   *
   * Carries `avatarToken` because the inline assignee picker renders each
   * member as an `Avatar` — a name-only list was the reason that picker showed
   * plain text where every other surface shows a face (Requirement 13.6).
   */
  readonly members: readonly {
    readonly id: string;
    readonly name: string;
    readonly avatarToken: AvatarColorToken;
  }[];
  readonly onMoveToList: (
    taskId: string,
    toListId: string,
  ) => Promise<Result<unknown>>;
  readonly onMoveTask: (
    taskId: string,
    toStatusId: string,
    toIndex: number,
  ) => Promise<Result<MoveTaskResult>>;
  readonly onQuickUpdate: (
    taskId: string,
    input: UpdateTaskInput,
  ) => Promise<Result<unknown>>;
  readonly onToggleComplete: (taskId: string) => Promise<Result<unknown>>;
  readonly onCreateTask: (
    statusId: string,
    title: string,
  ) => Promise<Result<unknown>>;
  readonly onDeleteTask: (taskId: string) => Promise<Result<unknown>>;
  readonly onDuplicateTask: (taskId: string) => Promise<Result<unknown>>;
}

/**
 * Builds a card view-model.
 *
 * Every display decision — the priority token, the overdue tone, the initials
 * — is resolved here rather than in the card, so the same values feed the
 * kanban card, the table row and the drawer and cannot diverge
 * (Requirement 13.6, 5.8).
 */
export function buildTaskCard(
  state: Parameters<typeof selectAssignees>[0],
  task: {
    id: string;
    title: string;
    priority: Priority;
    dueDate: string | null;
    assigneeIds: readonly string[];
    description: string | null;
    statusId: string;
  },
  now: string,
  /** Recursion depth. Callers start at 0; only this function passes more. */
  depth = 0,
): TaskCardViewModel {
  const priority = PRIORITY_CONFIG[task.priority];

  /*
   * Children are built recursively, which terminates on its own because the
   * Model caps nesting at `MAX_TASK_DEPTH` — a subtask has no subtasks, so
   * `subtasksOf` returns nothing one level down.
   *
   * The explicit guard is belt and braces rather than decoration: raising that
   * cap should deepen this tree deliberately, not hand it an unbounded one and
   * blow the stack on the first malformed parent chain.
   */
  const subtasks =
    depth >= MAX_TASK_DEPTH
      ? []
      : subtasksOf(state, task.id).map((subtask) =>
          buildTaskCard(state, subtask, now, depth + 1),
        );

  /*
   * Counted off the built children rather than re-derived from `statuses`.
   * The badge and the rows it summarises now read the same `isComplete` the
   * child card renders, so "1 of 2" cannot disagree with the ticks beneath it.
   */
  const completed = subtasks.filter((subtask) => subtask.isComplete).length;

  return {
    id: task.id,
    statusId: task.statusId,
    title: task.title,
    priority: task.priority,
    priorityLabel: priority.label,
    priorityToken: priority.token,
    dueDate: task.dueDate,
    dueDateTone: dueDateTone(task.dueDate, now),
    assignees: selectAssignees(state, task.assigneeIds).map((user) => ({
      id: user.id,
      name: user.name,
      initials: user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join(""),
      avatarToken: user.avatarToken,
    })),
    subtasks,
    subtaskCount: subtasks.length,
    completedSubtaskCount: completed,
    isComplete: state.statuses[task.statusId]?.category === "done",
    hasDescription:
      task.description !== null && task.description.trim().length > 0,
  };
}

/**
 * The kanban board.
 *
 * `now` is passed in rather than read from the clock inside the hook, so a
 * story or a test can render "overdue" deterministically.
 */
export function useBoard(
  listId: string | null,
  now: string = new Date().toISOString(),
): BoardViewModel {
  const scope = useScope();
  const actions = useStore((state) => state.actions.task);
  const loadingListId = useStore((state) => state.loadingListId);
  const isHydrating = useStore((state) => state.isHydrating);
  const permissions = usePermissions();

  /*
   * Permission, not emptiness. An earlier version tested whether the board had
   * any columns, which made an empty-but-editable list read-only and a
   * populated-but-denied list editable.
   */
  const canEdit = useStore((state) =>
    listId === null ? false : can(state, scope, "task:update", listId),
  );

  /*
   * Derived in `useMemo` from the whole store, not mapped inside a
   * `useShallow` selector — see the note in `useVisibleTree`. Fresh card
   * objects defeat shallow comparison and send zustand into a render loop.
   */
  const state = useStore();

  const columns = useMemo((): readonly BoardColumnViewModel[] => {
    if (listId === null) return [];

    return selectBoardColumns(state, scope, listId).map((column) => ({
      statusId: column.status.id,
      name: column.status.name,
      colorToken: column.status.color,
      count: column.count,
      tasks: column.tasks.map((task) => buildTaskCard(state, task, now)),
    }));
  }, [state, scope, listId, now]);

  const onMoveTask = useCallback(
    (taskId: string, toStatusId: string, toIndex: number) =>
      actions.move(scope, { taskId, toStatusId, toIndex }),
    [actions, scope],
  );

  const onQuickUpdate = useCallback(
    (taskId: string, input: UpdateTaskInput) =>
      actions.update(scope, taskId, input),
    [actions, scope],
  );

  const onToggleComplete = useCallback(
    (taskId: string) => actions.toggleComplete(scope, taskId),
    [actions, scope],
  );

  const onCreateTask = useCallback(
    (statusId: string, title: string) =>
      actions.create(scope, { listId: listId ?? "", title, statusId }),
    [actions, scope, listId],
  );

  const onDeleteTask = useCallback(
    (taskId: string) => actions.remove(scope, taskId),
    [actions, scope],
  );

  const onDuplicateTask = useCallback(
    (taskId: string) => actions.duplicate(scope, taskId),
    [actions, scope],
  );

  const onMoveToList = useCallback(
    (taskId: string, toListId: string) =>
      actions.moveToList(scope, taskId, toListId),
    [actions, scope],
  );

  /** Lists other than this one that the user may write to. */
  const moveTargets = useMemo(
    () =>
      selectEditableLists(state, scope)
        .filter((list) => list.id !== listId)
        .map((list) => ({ id: list.id, name: list.name })),
    [state, scope, listId],
  );

  const members = useMemo(
    () =>
      selectWorkspaceMembers(state, scope).map((user) => ({
        id: user.id,
        name: user.name,
        avatarToken: user.avatarToken,
      })),
    [state, scope],
  );

  return useMemo(
    () => ({
      columns,
      isLoading: isHydrating || loadingListId === listId,
      isEmpty: columns.every((column) => column.count === 0),
      canEdit,
      readOnlyReason:
        listId === null
          ? undefined
          : permissions.reasonFor("task:update", listId),
      moveTargets,
      members,
      onMoveTask,
      onMoveToList,
      onQuickUpdate,
      onToggleComplete,
      onCreateTask,
      onDeleteTask,
      onDuplicateTask,
    }),
    [
      columns,
      isHydrating,
      loadingListId,
      listId,
      canEdit,
      permissions,
      moveTargets,
      members,
      onMoveTask,
      onMoveToList,
      onQuickUpdate,
      onToggleComplete,
      onCreateTask,
      onDeleteTask,
      onDuplicateTask,
    ],
  );
}

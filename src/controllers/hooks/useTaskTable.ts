import { useCallback, useMemo } from "react";

import type { AvatarColorToken } from "@/config/avatars";
import { PAGE_SIZE } from "@/config/limits";
import type { StatusColorToken } from "@/config/statusCategories";
import { can } from "@/model/permissions";
import type { Result } from "@/model/result";
import {
  selectPaginatedRows,
  selectStatusesForList,
  selectTaskRows,
  selectWorkspaceMembers,
} from "@/model/selectors";
import type { SortState } from "@/model/types";

import type { UpdateTaskInput } from "../slices/types";
import { useStore } from "../store";

import { buildTaskCard, type TaskCardViewModel } from "./useBoard";
import { usePermissions } from "./usePermissions";
import { useScope } from "./useScope";

/** A table row: a top-level task plus its nested subtasks. */
export interface TaskRowViewModel {
  readonly task: TaskCardViewModel;
  readonly statusId: string;
  readonly statusName: string;
  /** Token, not a class — `StatusPill` resolves it through the shared map. */
  readonly statusToken: StatusColorToken;
  readonly subtasks: readonly TaskRowViewModel[];
}

/** A status of the selected list, for the inline status picker. */
export interface TableStatusOption {
  readonly id: string;
  readonly name: string;
  readonly colorToken: StatusColorToken;
}

export interface TaskTableViewModel {
  readonly rows: readonly TaskRowViewModel[];
  /**
   * Every status of this list, so a row's pill can become a picker. The rows
   * carry only their own status; changing one needs the whole set
   * (Requirement 5.8).
   */
  readonly statuses: readonly TableStatusOption[];
  /** Workspace members, for assigning from a row (Requirement 15.2). */
  readonly members: readonly {
    readonly id: string;
    readonly name: string;
    readonly avatarToken: AvatarColorToken;
  }[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly isEmpty: boolean;
  readonly canEdit: boolean;
  /** Why editing is refused, or undefined when it is not (Req 8.11, 17.2). */
  readonly readOnlyReason: string | undefined;
  readonly sort: SortState;
  readonly onQuickUpdate: (
    taskId: string,
    input: UpdateTaskInput,
  ) => Promise<Result<unknown>>;
  readonly onToggleComplete: (taskId: string) => Promise<Result<unknown>>;
  /**
   * Creates into the list's first status, so the list view's empty state can
   * carry the primary action instead of deferring to the board
   * (Requirement 5.9).
   */
  readonly onCreate: (title: string) => Promise<Result<unknown>>;
  /**
   * Creates a subtask under `parentTaskId`, in the same list.
   *
   * Takes the parent's id rather than closing over one, which is the whole
   * reason this is a separate callback from `onCreate`. The drawer can bind
   * `onAddSubtask` to the open task because there is only ever one of those;
   * this view has every task in the list on screen at once, so a bound
   * callback would file the new subtask under whichever task the hook happened
   * to capture. That would not error — it would silently parent it to the
   * wrong task, which is worse than a refusal. Same shape, and the same
   * reasoning, as `onSubtaskUpdate` on the drawer's view-model
   * (Requirement 7.4.1.2).
   *
   * Depth is left to the Controller: `create` already runs
   * `validateSubtaskDepth` against `MAX_TASK_DEPTH`, so this cannot produce a
   * subtask of a subtask even if a caller offers the affordance where it
   * should not.
   */
  readonly onCreateSubtask: (
    parentTaskId: string,
    title: string,
  ) => Promise<Result<unknown>>;
}

/**
 * The list view.
 *
 * Sort state and page are passed in rather than held here, because both belong
 * to the view that renders them — a second table on screen would otherwise
 * share one sort order (Requirement 5.2, 9.12).
 */
export function useTaskTable(
  listId: string | null,
  sort: SortState,
  page: number,
  now: string = new Date().toISOString(),
): TaskTableViewModel {
  const scope = useScope();
  const actions = useStore((state) => state.actions.task);
  const isHydrating = useStore((state) => state.isHydrating);
  const loadingListId = useStore((state) => state.loadingListId);
  const permissions = usePermissions();

  /*
   * Derived in `useMemo` from the whole store, not mapped inside a
   * `useShallow` selector — see the note in `useVisibleTree`. Fresh row objects
   * defeat shallow comparison and send zustand into a render loop.
   */
  const state = useStore();

  const { rows, total, hasMore, statuses } = useMemo(() => {
    if (listId === null) {
      return {
        rows: [] as readonly TaskRowViewModel[],
        total: 0,
        hasMore: false,
        statuses: [] as readonly TableStatusOption[],
      };
    }

    const statuses = selectStatusesForList(state, scope, listId);
    const statusById = new Map(statuses.map((status) => [status.id, status]));

    const allRows = selectTaskRows(state, scope, listId, sort);
    const paged = selectPaginatedRows(allRows, page, PAGE_SIZE);

    const toRow = (
      task: (typeof allRows)[number]["task"],
    ): TaskRowViewModel => {
      const status = statusById.get(task.statusId);

      return {
        task: buildTaskCard(state, task, now),
        statusId: task.statusId,
        statusName: status?.name ?? "Unknown",
        statusToken: status?.color ?? "status-todo",
        subtasks: [],
      };
    };

    return {
      rows: paged.items.map((row) => ({
        ...toRow(row.task),
        subtasks: row.subtasks.map(toRow),
      })),
      total: paged.total,
      hasMore: paged.hasMore,
      statuses: statuses.map((status) => ({
        id: status.id,
        name: status.name,
        colorToken: status.color,
      })),
    };
  }, [state, scope, listId, sort, page, now]);

  const onQuickUpdate = useCallback(
    (taskId: string, input: UpdateTaskInput) =>
      actions.update(scope, taskId, input),
    [actions, scope],
  );

  const onToggleComplete = useCallback(
    (taskId: string) => actions.toggleComplete(scope, taskId),
    [actions, scope],
  );

  const onCreate = useCallback(
    (title: string) => actions.create(scope, { listId: listId ?? "", title }),
    [actions, scope, listId],
  );

  /*
   * `listId` is the selected list, not a lookup from the parent, because every
   * row this view renders belongs to it — and a subtask must live in its
   * parent's list anyway, which `create` enforces through
   * `validateSubtaskList`.
   */
  const onCreateSubtask = useCallback(
    (parentTaskId: string, title: string) =>
      actions.create(scope, { listId: listId ?? "", title, parentTaskId }),
    [actions, scope, listId],
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

  const canEdit = useMemo(
    () => (listId === null ? false : can(state, scope, "task:update", listId)),
    [state, scope, listId],
  );

  return useMemo(
    () => ({
      rows,
      statuses,
      members,
      total,
      hasMore,
      isLoading: isHydrating || loadingListId === listId,
      isEmpty: total === 0,
      canEdit,
      readOnlyReason:
        listId === null
          ? undefined
          : permissions.reasonFor("task:update", listId),
      sort,
      onQuickUpdate,
      onToggleComplete,
      onCreate,
      onCreateSubtask,
    }),
    [
      rows,
      statuses,
      members,
      total,
      hasMore,
      isHydrating,
      loadingListId,
      listId,
      canEdit,
      permissions,
      sort,
      onQuickUpdate,
      onToggleComplete,
      onCreate,
      onCreateSubtask,
    ],
  );
}

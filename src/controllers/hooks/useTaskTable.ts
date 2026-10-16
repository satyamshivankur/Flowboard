import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { PAGE_SIZE } from "@/config/limits";
import type { Result } from "@/model/result";
import {
  selectPaginatedRows,
  selectStatusesForList,
  selectTaskRows,
} from "@/model/selectors";
import type { SortState } from "@/model/types";

import type { UpdateTaskInput } from "../slices/types";
import { useStore } from "../store";

import { buildTaskCard, type TaskCardViewModel } from "./useBoard";
import { useScope } from "./useScope";

/** A table row: a top-level task plus its nested subtasks. */
export interface TaskRowViewModel {
  readonly task: TaskCardViewModel;
  readonly statusId: string;
  readonly statusName: string;
  readonly statusToken: string;
  readonly subtasks: readonly TaskRowViewModel[];
}

export interface TaskTableViewModel {
  readonly rows: readonly TaskRowViewModel[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly isEmpty: boolean;
  readonly sort: SortState;
  readonly onQuickUpdate: (
    taskId: string,
    input: UpdateTaskInput,
  ) => Promise<Result<unknown>>;
  readonly onToggleComplete: (taskId: string) => Promise<Result<unknown>>;
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

  const { rows, total, hasMore } = useStore(
    useShallow((state) => {
      if (listId === null) {
        return {
          rows: [] as readonly TaskRowViewModel[],
          total: 0,
          hasMore: false,
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
      };
    }),
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

  return useMemo(
    () => ({
      rows,
      total,
      hasMore,
      isLoading: isHydrating || loadingListId === listId,
      isEmpty: total === 0,
      sort,
      onQuickUpdate,
      onToggleComplete,
    }),
    [
      rows,
      total,
      hasMore,
      isHydrating,
      loadingListId,
      listId,
      sort,
      onQuickUpdate,
      onToggleComplete,
    ],
  );
}

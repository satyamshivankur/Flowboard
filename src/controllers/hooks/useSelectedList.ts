import { useMemo } from "react";

import { canView } from "@/model/permissions";
import {
  selectBoardColumns,
  selectBreadcrumb,
  selectVisibleLists,
} from "@/model/selectors";

import { useStore } from "../store";

import { useScope } from "./useScope";

export interface ListRef {
  readonly id: string;
  readonly name: string;
}

export interface SelectedListViewModel {
  /** True when the list exists and the current user may see it. */
  readonly isVisible: boolean;
  /** The name, even when denied, so the error can say which list it was. */
  readonly name: string | undefined;
  readonly breadcrumb: readonly ListRef[];
  /** Ids to expand so the selected list is actually on screen. */
  readonly expansionPath: readonly string[];
  /** A few lists the user can see, for recovering from a denied selection. */
  readonly suggestions: readonly ListRef[];
  readonly firstListId: string | undefined;
  /**
   * Task ids in the selected list, in board order, so the drawer can offer
   * previous/next without knowing which view is showing (Requirement 7.11).
   */
  readonly orderedTaskIds: readonly string[];
}

/**
 * Everything the shell needs to know about the selected list.
 *
 * This exists because `AppShell` was reading the store directly, which the
 * boundary lint rejected — correctly. Views read through hooks so permission
 * resolution stays in one layer (Requirement 10.4, 10.5).
 *
 * Derives from the whole store in `useMemo`; see the note in `useVisibleTree`
 * for why mapping inside a `useShallow` selector loops instead.
 */
export function useSelectedList(listId: string | null): SelectedListViewModel {
  const scope = useScope();
  const state = useStore();

  return useMemo(() => {
    const isVisible = listId !== null && canView(state, scope, listId);

    const breadcrumb: readonly ListRef[] = isVisible
      ? selectBreadcrumb(state, scope, listId).map((node) => ({
          id: node.id,
          name: node.name,
        }))
      : [];

    const visibleLists = selectVisibleLists(state, scope).map((list) => ({
      id: list.id,
      name: list.name,
    }));

    // `isVisible` already implies `listId !== null`; TypeScript carries that
    // narrowing through the alias, so no redundant null check here.
    const orderedTaskIds = isVisible
      ? selectBoardColumns(state, scope, listId).flatMap((column) =>
          column.tasks.map((task) => task.id),
        )
      : [];

    return {
      isVisible,
      name: listId === null ? undefined : state.containers[listId]?.name,
      breadcrumb,
      // The leaf is the list itself; only its ancestors need expanding.
      expansionPath: breadcrumb.slice(0, -1).map((node) => node.id),
      suggestions: visibleLists.slice(0, 3),
      firstListId: visibleLists[0]?.id,
      orderedTaskIds,
    };
  }, [state, scope, listId]);
}

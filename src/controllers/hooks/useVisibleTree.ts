import { useMemo } from "react";

import { CONTAINER_REGISTRY, type ContainerType } from "@/config/containers";
import {
  selectFirstVisibleList,
  selectVisibleTree,
  type TreeNode,
} from "@/model/selectors";

import { useStore } from "../store";

import { useScope } from "./useScope";

/** A tree row as the sidebar renders it — flat, with no store objects. */
export interface TreeRowViewModel {
  readonly id: string;
  readonly name: string;
  readonly type: ContainerType;
  /** `null` on a top-level node. Needed to resolve a drop as reorder vs move. */
  readonly parentId: string | null;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly hasHiddenChildren: boolean;
  readonly holdsTasks: boolean;
  readonly childTypes: readonly ContainerType[];
  /** True when this type may be renamed or archived at all. */
  readonly mutable: boolean;
  readonly children: readonly TreeRowViewModel[];
}

export interface TreeViewModel {
  readonly nodes: readonly TreeRowViewModel[];
  readonly isLoading: boolean;
  /** Where to navigate when the selected list becomes invisible. */
  readonly firstListId: string | undefined;
}

function toRow(node: TreeNode): TreeRowViewModel {
  const config = CONTAINER_REGISTRY[node.container.type];

  return {
    id: node.container.id,
    name: node.container.name,
    type: node.container.type,
    parentId: node.container.parentId,
    depth: node.depth,
    hasChildren: node.children.length > 0,
    hasHiddenChildren: node.hasHiddenChildren,
    holdsTasks: node.holdsTasks,
    childTypes: config.childTypes,
    mutable: config.mutable,
    children: node.children.map(toRow),
  };
}

/**
 * Whether a row can be opened.
 *
 * Includes nodes whose children are all hidden from this user. Those have no
 * visible children to reveal, but they do have the "no lists you can access"
 * hint — and gating the chevron on `hasChildren` alone made that hint
 * unreachable, since there was nothing to click (Requirement 6.8).
 */
export function isExpandable(row: TreeRowViewModel): boolean {
  return row.hasChildren || row.hasHiddenChildren;
}

/**
 * Flattens the tree to the rows actually on screen, honouring expansion.
 *
 * Both keyboard navigation and drag-and-drop need a linear sequence: arrow keys
 * move through what is visible, and dnd-kit's sortable needs a flat item list.
 * Deriving it here keeps one definition of "visible row order".
 */
export function flattenRows(
  rows: readonly TreeRowViewModel[],
  expandedIds: ReadonlySet<string>,
): readonly TreeRowViewModel[] {
  return rows.flatMap((row) =>
    expandedIds.has(row.id) && row.children.length > 0
      ? [row, ...flattenRows(row.children, expandedIds)]
      : [row],
  );
}

/**
 * The sidebar tree, already permission-filtered by the Model.
 *
 * Subscribes to the whole store and derives in `useMemo`, rather than mapping
 * inside the selector with `useShallow`. That is not a style choice: a selector
 * that builds fresh objects fails `useShallow`'s one-level reference
 * comparison on every element, so zustand sees a new snapshot on every render
 * and re-renders forever. The symptom is "Maximum update depth exceeded" from
 * `forceStoreRerender`, which points at React rather than at the selector.
 *
 * The store object's identity only changes when a mutation lands, so this
 * re-derives exactly when the data changes.
 */
export function useVisibleTree(): TreeViewModel {
  const scope = useScope();
  const state = useStore();

  return useMemo(() => {
    const nodes = selectVisibleTree(state, scope).map(toRow);

    return {
      nodes,
      isLoading: state.isHydrating,
      firstListId: selectFirstVisibleList(state, scope)?.id,
    };
  }, [state, scope]);
}

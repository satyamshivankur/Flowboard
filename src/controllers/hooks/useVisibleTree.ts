import { useMemo } from "react";
import { useShallow } from "zustand/shallow";

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
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly hasHiddenChildren: boolean;
  readonly holdsTasks: boolean;
  readonly childTypes: readonly ContainerType[];
  readonly children: readonly TreeRowViewModel[];
}

export interface TreeViewModel {
  readonly nodes: readonly TreeRowViewModel[];
  readonly isLoading: boolean;
  /** Where to navigate when the selected list becomes invisible. */
  readonly firstListId: string | undefined;
}

function toRow(node: TreeNode): TreeRowViewModel {
  return {
    id: node.container.id,
    name: node.container.name,
    type: node.container.type,
    depth: node.depth,
    hasChildren: node.children.length > 0,
    hasHiddenChildren: node.hasHiddenChildren,
    holdsTasks: node.holdsTasks,
    childTypes: CONTAINER_REGISTRY[node.container.type].childTypes,
    children: node.children.map(toRow),
  };
}

/**
 * The sidebar tree, already permission-filtered by the Model.
 *
 * The View receives plain rows rather than `Container` entities, so a component
 * cannot reach from a tree row back into the domain and start making its own
 * decisions (Requirement 10.4).
 */
export function useVisibleTree(): TreeViewModel {
  const scope = useScope();
  const isHydrating = useStore((state) => state.isHydrating);

  const nodes = useStore(
    useShallow((state) => selectVisibleTree(state, scope).map(toRow)),
  );

  const firstListId = useStore(
    (state) => selectFirstVisibleList(state, scope)?.id,
  );

  return useMemo(
    () => ({ nodes, isLoading: isHydrating, firstListId }),
    [nodes, isHydrating, firstListId],
  );
}

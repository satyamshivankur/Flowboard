import { useCallback, useMemo } from "react";

import type { ContainerType } from "@/config/containers";
import type { ContainerAccess } from "@/model/access";
import type { Result } from "@/model/result";
import type { Container } from "@/model/types";

import { useStore } from "../store";

import { useScope } from "./useScope";

export interface ContainerActionsViewModel {
  readonly create: (
    parentId: string,
    type: ContainerType,
    name: string,
    access?: ContainerAccess,
  ) => Promise<Result<Container>>;
  readonly rename: (
    containerId: string,
    name: string,
  ) => Promise<Result<Container>>;
  readonly setAccess: (
    containerId: string,
    access: ContainerAccess,
  ) => Promise<Result<Container>>;
  readonly archive: (
    containerId: string,
  ) => Promise<Result<{ readonly archivedIds: readonly string[] }>>;
  readonly unarchive: (
    containerId: string,
  ) => Promise<Result<{ readonly restoredIds: readonly string[] }>>;
  readonly reorder: (
    containerId: string,
    toIndex: number,
  ) => Promise<Result<Container>>;
  readonly move: (
    containerId: string,
    newParentId: string,
    toIndex: number,
  ) => Promise<Result<Container>>;
}

/**
 * Container mutations, with the scope already bound.
 *
 * The sidebar's context menus call these; whether a menu item is enabled comes
 * from `usePermissions`. Both paths end at the same capability check in the
 * pipeline, so a stale enabled button still cannot mutate anything
 * (Requirement 8.12).
 */
export function useContainerActions(): ContainerActionsViewModel {
  const scope = useScope();
  const actions = useStore((state) => state.actions.container);

  const create = useCallback(
    (
      parentId: string,
      type: ContainerType,
      name: string,
      access?: ContainerAccess,
    ) =>
      actions.create(scope, {
        parentId,
        type,
        name,
        ...(access === undefined ? {} : { access }),
      }),
    [actions, scope],
  );

  const rename = useCallback(
    (containerId: string, name: string) =>
      actions.rename(scope, containerId, name),
    [actions, scope],
  );

  const setAccess = useCallback(
    (containerId: string, access: ContainerAccess) =>
      actions.setAccess(scope, containerId, access),
    [actions, scope],
  );

  const archive = useCallback(
    (containerId: string) => actions.archive(scope, containerId),
    [actions, scope],
  );

  const unarchive = useCallback(
    (containerId: string) => actions.unarchive(scope, containerId),
    [actions, scope],
  );

  const reorder = useCallback(
    (containerId: string, toIndex: number) =>
      actions.reorder(scope, containerId, toIndex),
    [actions, scope],
  );

  const move = useCallback(
    (containerId: string, newParentId: string, toIndex: number) =>
      actions.move(scope, containerId, newParentId, toIndex),
    [actions, scope],
  );

  return useMemo(
    () => ({ create, rename, setAccess, archive, unarchive, reorder, move }),
    [create, rename, setAccess, archive, unarchive, reorder, move],
  );
}

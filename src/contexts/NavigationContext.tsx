import { useCallback, useMemo, useState, type ReactNode } from "react";

import { DEFAULT_VIEW, isViewId, type ViewId } from "@/config/views";
import { readPreference, writePreference } from "@/lib/uiStorage";

import { createSafeContext } from "./createSafeContext";

/**
 * What the user is looking at.
 *
 * Holds **ids only**, never entities. Keeping the selected list as an id rather
 * than a `Container` means there is one source of truth for the data and this
 * context cannot go stale against the store (Requirement 12.6).
 */

export interface NavigationContextValue {
  readonly selectedListId: string | null;
  readonly view: ViewId;
  readonly openTaskId: string | null;
  readonly searchOpen: boolean;
  readonly selectList: (listId: string | null) => void;
  readonly setView: (view: ViewId) => void;
  readonly openTask: (taskId: string | null) => void;
  readonly closeTask: () => void;
  readonly setSearchOpen: (open: boolean) => void;
}

const VIEW_KEY = "view";

const { Provider, useValue } =
  createSafeContext<NavigationContextValue>("Navigation");

export const useNavigation = useValue;

export function NavigationProvider({
  children,
  initialListId = null,
}: {
  children: ReactNode;
  initialListId?: string | null;
}) {
  const [selectedListId, setSelectedListId] = useState<string | null>(
    initialListId,
  );
  const [view, setViewState] = useState<ViewId>(() => {
    const stored = readPreference<string>(VIEW_KEY, DEFAULT_VIEW);
    return isViewId(stored) ? stored : DEFAULT_VIEW;
  });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const selectList = useCallback((listId: string | null) => {
    setSelectedListId(listId);
    /*
     * Changing list closes the drawer. A drawer left open would be showing a
     * task from the list the user just navigated away from, which reads as a
     * bug rather than as persistence.
     */
    setOpenTaskId(null);
  }, []);

  const setView = useCallback((next: ViewId) => {
    setViewState(next);
    writePreference(VIEW_KEY, next);
  }, []);

  const openTask = useCallback((taskId: string | null) => {
    setOpenTaskId(taskId);
  }, []);

  const closeTask = useCallback(() => {
    setOpenTaskId(null);
  }, []);

  const value = useMemo(
    () => ({
      selectedListId,
      view,
      openTaskId,
      searchOpen,
      selectList,
      setView,
      openTask,
      closeTask,
      setSearchOpen,
    }),
    [
      selectedListId,
      view,
      openTaskId,
      searchOpen,
      selectList,
      setView,
      openTask,
      closeTask,
    ],
  );

  return <Provider value={value}>{children}</Provider>;
}

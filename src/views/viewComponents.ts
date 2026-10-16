import type { ComponentType } from "react";

import type { ViewId } from "@/config/views";

import { KanbanBoard } from "./board/KanbanBoard";
import { TaskListView } from "./list/TaskListView";

export interface ViewProps {
  readonly listId: string;
}

/**
 * The component half of the view registry.
 *
 * `VIEW_REGISTRY` in `src/config/views.ts` holds each view's id, label and
 * icon; this holds its component, keyed by the same `ViewId`. Splitting them is
 * what keeps a config module from importing the View layer and inverting the
 * dependency direction — the boundary lint rejects the alternative.
 *
 * Adding a calendar view is one entry in each file. Nothing else changes: the
 * view switcher maps over the registry and the content region looks up here
 * (Requirement 21.5).
 */
export const VIEW_COMPONENTS: Record<ViewId, ComponentType<ViewProps>> = {
  board: KanbanBoard,
  list: TaskListView,
};

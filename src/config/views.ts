import { Columns3, Rows3, type LucideIcon } from 'lucide-react'

/**
 * View metadata.
 *
 * This file holds the *description* of each view — id, label, icon — and
 * deliberately not its component, which would make a config module import the
 * View layer. The component mapping lives in `src/views/viewComponents.ts`,
 * keyed by the same `ViewId`, so the registry stays dependency-free while
 * remaining the single enumeration of the view set (Requirement 21.5).
 *
 * Adding a calendar view is one entry here plus one entry there. The view
 * switcher, NavigationContext and content region all iterate the registry and
 * need no change.
 */
export type ViewId = 'board' | 'list'

export interface ViewMeta {
  readonly id: ViewId
  readonly label: string
  readonly icon: LucideIcon
  /** Smallest viewport at which this view is offered, in rem. */
  readonly minViewportRem?: number
}

export const VIEW_REGISTRY: Record<ViewId, ViewMeta> = {
  board: { id: 'board', label: 'Board', icon: Columns3 },
  list: { id: 'list', label: 'List', icon: Rows3 },
}

export const VIEW_IDS = Object.keys(VIEW_REGISTRY) as ViewId[]

export const DEFAULT_VIEW: ViewId = 'board'

export function viewMeta(id: ViewId): ViewMeta {
  return VIEW_REGISTRY[id]
}

export function isViewId(value: unknown): value is ViewId {
  return typeof value === 'string' && value in VIEW_REGISTRY
}

/**
 * Date helpers for due-date display and sorting.
 *
 * All functions take an explicit `now` so that rendering and tests are
 * deterministic — nothing in here reads the clock on its own.
 */

export type DueDateTone = 'overdue' | 'today' | 'upcoming' | 'none'

const MS_PER_DAY = 86_400_000

function startOfDay(iso: string): number {
  const d = new Date(iso)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Resolves the display tone for a due date. Overdue and due-today are the two
 * states worth colouring; everything else stays neutral so the signal is not
 * diluted (Requirement 15.8).
 */
export function dueDateTone(
  dueDate: string | null,
  now: string,
): DueDateTone {
  if (!dueDate) return 'none'

  const due = startOfDay(dueDate)
  const today = startOfDay(now)

  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return 'upcoming'
}

/** Whole days between two ISO datetimes, positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY)
}

/** `Oct 12` for the current year, `Oct 12, 2025` otherwise. */
export function formatDueDate(dueDate: string, now: string): string {
  const due = new Date(dueDate)
  const sameYear = due.getUTCFullYear() === new Date(now).getUTCFullYear()

  return due.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  })
}

/** `4m ago`, `3h ago`, `2d ago` — for the drawer's updated timestamp. */
export function formatRelative(iso: string, now: string): string {
  const diffMs = new Date(now).getTime() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${String(days)}d ago`

  return formatDueDate(iso, now)
}

/**
 * Comparator putting tasks without a due date last regardless of direction
 * (Requirement 5.4). Returns a stable 0 when both are absent.
 */
export function compareDueDate(
  a: string | null,
  b: string | null,
  direction: 'asc' | 'desc',
): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1

  const delta = new Date(a).getTime() - new Date(b).getTime()
  return direction === 'asc' ? delta : -delta
}

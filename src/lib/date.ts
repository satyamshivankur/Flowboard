/**
 * Date helpers for due-date display and sorting.
 *
 * All functions take an explicit `now` so that rendering and tests are
 * deterministic — nothing in here reads the clock on its own.
 */

export type DueDateTone = "overdue" | "today" | "upcoming" | "none";

const MS_PER_DAY = 86_400_000;

function startOfDay(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Resolves the display tone for a due date. Overdue and due-today are the two
 * states worth colouring; everything else stays neutral so the signal is not
 * diluted (Requirement 15.8).
 */
export function dueDateTone(dueDate: string | null, now: string): DueDateTone {
  if (!dueDate) return "none";

  const due = startOfDay(dueDate);
  const today = startOfDay(now);

  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

/** Whole days between two ISO datetimes, positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
}

/** `Oct 12` for the current year, `Oct 12, 2025` otherwise. */
export function formatDueDate(dueDate: string, now: string): string {
  const due = new Date(dueDate);
  const sameYear = due.getUTCFullYear() === new Date(now).getUTCFullYear();

  return due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

/** `4m ago`, `3h ago`, `2d ago` — for the drawer's updated timestamp. */
export function formatRelative(iso: string, now: string): string {
  const diffMs = new Date(now).getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${String(minutes)}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${String(days)}d ago`;

  return formatDueDate(iso, now);
}

/**
 * Comparator putting tasks without a due date last regardless of direction
 * (Requirement 5.4). Returns a stable 0 when both are absent.
 */
export function compareDueDate(
  a: string | null,
  b: string | null,
  direction: "asc" | "desc",
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  const delta = new Date(a).getTime() - new Date(b).getTime();
  return direction === "asc" ? delta : -delta;
}

/**
 * An ISO due date `days` from `now`, normalised to 09:00 UTC.
 *
 * Quick due-date actions on a card and the drawer's date input must produce
 * identical values, or the same date typed two ways would sort differently.
 * Fixing the time of day here is what guarantees that (Requirement 15.2).
 */
export function dueDateAtDays(now: string, days: number): string {
  const base = new Date(startOfDay(now) + days * MS_PER_DAY);

  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 9),
  ).toISOString();
}

/*
 * Calendar days versus instants.
 *
 * A due date is stored as an instant — 09:00 UTC — but what a user picks is a
 * *calendar day*, and the two are not interchangeable. Calendar libraries,
 * `@rehookify/datepicker` included, represent a day as local midnight, so
 * reading one of their dates with `getUTC*` yields the previous day for anyone
 * east of Greenwich.
 *
 * That bug was live for exactly one commit: a cell labelled "November 4"
 * carried the key `2026-11-03`. These four functions are the entire conversion
 * surface, and `date.test.ts` pins them under a non-UTC timezone.
 *
 * The rule: stored instants are read in UTC, calendar-library dates are read
 * locally, and nothing crosses between them without passing through here.
 */

/** `YYYY-MM-DD` for the day a *local-midnight* `Date` represents. */
export function toDayKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * A local-midnight `Date` for a `YYYY-MM-DD` — the shape a calendar library
 * expects. Null for anything that is not a real date.
 *
 * Strict by design: `new Date("2026-02-31")` rolls silently into March, and a
 * due date landing a month away from what was typed is worse than a rejected
 * edit. The parsed parts are checked back against the input to catch it.
 */
export function fromDayKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);

  if (year === undefined || month === undefined || day === undefined)
    return null;

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * The stored instant for a calendar day, normalised to 09:00 UTC.
 *
 * Every path that sets a due date goes through here — the card's quick menu,
 * the typed field and the calendar — so two of them cannot write different
 * times of day for "the 14th" and then sort inconsistently
 * (Requirement 5.4).
 */
export function toDueDateIso(date: Date): string {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 9),
  ).toISOString();
}

/**
 * The calendar day of a stored due date.
 *
 * Read in UTC, matching `startOfDay` above — which is what decides overdue and
 * due-today — so the date shown in the field is the date the board colours.
 */
export function dueDateToDayKey(iso: string): string {
  return iso.slice(0, 10);
}

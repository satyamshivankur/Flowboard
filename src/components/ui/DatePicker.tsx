import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { useDatePicker, type DPDay } from "@rehookify/datepicker";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import {
  dueDateToDayKey,
  formatDueDate,
  fromDayKey,
  toDayKey,
  toDueDateIso,
} from "@/lib/date";

import { Button } from "./Button";
import { IconButton } from "./IconButton";

export interface DatePickerProps {
  /** Full ISO datetime, or null for unset. */
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly size?: "sm" | "md" | undefined;
  /** Reference "today", injected so stories and tests are deterministic. */
  readonly now?: string | undefined;
  readonly minDate?: Date | undefined;
  readonly maxDate?: Date | undefined;
  readonly placeholder?: string | undefined;
  /**
   * Replaces the default field-shaped trigger.
   *
   * The inline form on a card or a row needs the `DueDateChip` itself to be
   * the trigger — including its overdue tone, which a generic button cannot
   * express.
   */
  readonly trigger?: ReactNode | undefined;
  /** Hides the separate clear button, for the compact inline form. */
  readonly hideClear?: boolean | undefined;
  readonly className?: string | undefined;
}

/** Days per week, named because it indexes the arrow-key arithmetic below. */
const WEEK = 7;

const TRIGGER_SIZE: Record<NonNullable<DatePickerProps["size"]>, string> = {
  sm: "min-h-8 px-2.5 text-xs",
  md: "min-h-9 px-3 text-sm",
};

/** Splits the flat 6×7 day list the hook returns into weeks. */
function intoWeeks(days: readonly DPDay[]): DPDay[][] {
  const weeks: DPDay[][] = [];

  for (let index = 0; index < days.length; index += WEEK) {
    weeks.push([...days.slice(index, index + WEEK)]);
  }

  return weeks;
}

/**
 * The one day that Tab reaches, and the day focused when the calendar opens.
 *
 * Prefers the day the user is on, but falls back to the first day of the
 * rendered month when that day is off screen. Without the fallback, paging to
 * another month left no tabbable day at all and Tab skipped the grid.
 */
function resolveTabbableDay(
  days: readonly DPDay[],
  preferredIso: string,
): string | null {
  const isRendered = days.some((day) => toDayKey(day.$date) === preferredIso);

  if (isRendered) return preferredIso;

  const fallback = days.find((day) => day.inCurrentMonth) ?? days[0];

  if (fallback === undefined) return null;

  return toDayKey(fallback.$date);
}

/** A readable name for a day cell, since "14" alone says very little. */
function dayLabel(day: DPDay, isToday: boolean): string {
  const readable = day.$date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return isToday ? `${readable}, today` : readable;
}

/**
 * The next focus target for a navigation key, or null if the key is not one.
 *
 * Separated from the handler so the key map reads as a table rather than as a
 * chain of branches, and so the year jumps sit beside the month ones instead
 * of being buried.
 */
function nextFocusDate(from: Date, key: string, shift: boolean): Date | null {
  const dayStep: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -WEEK,
    ArrowDown: WEEK,
  };

  const next = new Date(from);
  const step = dayStep[key];

  if (step !== undefined) {
    next.setDate(next.getDate() + step);
    return next;
  }

  // Monday-based, matching `startDay: 1`.
  const weekdayIndex = (next.getDay() + 6) % WEEK;

  if (key === "Home") {
    next.setDate(next.getDate() - weekdayIndex);
    return next;
  }

  if (key === "End") {
    next.setDate(next.getDate() + (6 - weekdayIndex));
    return next;
  }

  /*
   * Shift turns the month jump into a year jump. This exists because the field
   * is calendar-only: with no typed entry, reaching a date two years out had
   * to be more than twenty-four PageDowns.
   */
  if (key === "PageUp") {
    if (shift) next.setFullYear(next.getFullYear() - 1);
    else next.setMonth(next.getMonth() - 1);

    return next;
  }

  if (key === "PageDown") {
    if (shift) next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);

    return next;
  }

  return null;
}

/**
 * A date field whose only input is the calendar.
 *
 * Replaces `<input type="date">`. The native input is barely styleable and
 * renders differently in every browser, so it was the one control in the app
 * that ignored the token system; it also cannot show which day is today or
 * which days are out of range.
 *
 * Selection is deliberately calendar-only — there is no text field to type
 * into. That removes a whole class of input error (half-written dates,
 * ambiguous `03/04`, month-end rollover) at the cost of making the keyboard
 * path longer, so the grid carries a full set of movement keys rather than
 * arrows alone: Home and End for the week, PageUp and PageDown for the month,
 * and with Shift for the year (Requirement 17.1).
 *
 * `@rehookify/datepicker` supplies the calendar maths and nothing else: no
 * styles, no DOM, no dependencies of its own. It gives each day `aria-selected`
 * and a roving `tabIndex`, but no arrow-key handling, so the grid navigation
 * below is ours.
 */
export function DatePicker({
  value,
  onChange,
  label,
  disabled = false,
  size = "sm",
  now,
  minDate,
  maxDate,
  placeholder = "No date",
  trigger,
  hideClear = false,
  className,
}: DatePickerProps) {
  const reference = now ?? new Date().toISOString();
  const selected = value === null ? null : fromDayKey(dueDateToDayKey(value));

  /** Which month the calendar is showing. */
  const [offsetDate, setOffsetDate] = useState<Date>(
    () => selected ?? new Date(reference),
  );

  /** The day the grid should put focus on. */
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const { data, propGetters } = useDatePicker({
    selectedDates: selected === null ? [] : [selected],
    onDatesChange: (dates) => {
      const next = dates[0];

      onChange(next === undefined ? null : toDueDateIso(next));
    },
    offsetDate,
    onOffsetChange: setOffsetDate,
    calendar: { startDay: 1 },
    dates: {
      mode: "single",
      // Explicit Clear rather than click-to-deselect: a click that silently
      // unsets the date you just chose is not a discoverable affordance.
      toggle: false,
      ...(minDate === undefined ? {} : { minDate }),
      ...(maxDate === undefined ? {} : { maxDate }),
    },
  });

  const calendar = data.calendars[0];
  const days = calendar?.days ?? [];

  const todayKey = dueDateToDayKey(new Date(reference).toISOString());
  const preferredIso =
    focusDay ?? (selected === null ? todayKey : toDayKey(selected));
  const tabbableIso = resolveTabbableDay(days, preferredIso);

  /*
   * Moves focus after a keyboard move *within* the rendered month.
   *
   * `autoFocus` on the tabbable day covers the two mount cases — opening the
   * panel, and changing month, both of which remount the grid. It does
   * nothing for an arrow key that stays inside the current month, because
   * that only re-renders, and a day cannot `autoFocus` twice. Both mechanisms
   * are needed; neither covers the other.
   *
   * No state is written here, so this does not trip the `set-state-in-effect`
   * rule — the effect only moves DOM focus.
   */
  useEffect(() => {
    if (focusDay === null) return;

    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
      ?.focus();
  }, [focusDay, offsetDate]);

  /** Arrow, Home/End and Page navigation across the grid. */
  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const iso = (event.target as HTMLElement).dataset["day"];

    if (iso === undefined) return;

    const from = fromDayKey(iso);

    if (from === null) return;

    const next = nextFocusDate(from, event.key, event.shiftKey);

    if (next === null) return;

    event.preventDefault();

    /*
     * Pull the calendar across when the move leaves the rendered month, so
     * the target button exists for `autoFocus` to land on. Changing the
     * offset remounts the grid, which is what makes the focus move work
     * without an effect chasing the DOM.
     */
    if (
      next.getMonth() !== from.getMonth() ||
      next.getFullYear() !== from.getFullYear()
    ) {
      setOffsetDate(next);
    }

    setFocusDay(toDayKey(next));
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover className="min-w-0 flex-1">
        {trigger === undefined ? (
          <PopoverButton
            aria-label={label}
            disabled={disabled}
            className={cn(
              "inline-flex w-full items-center justify-between gap-2 rounded-md py-1",
              "bg-surface text-ink-900 ring-1 ring-border",
              "transition-shadow motion-reduce:transition-none",
              "can-hover:hover:bg-surface-hover",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
              "coarse-pointer:min-h-touch",
              "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-400",
              TRIGGER_SIZE[size],
            )}
          >
            {/*
              Formatted through the same helper `DueDateChip` uses, so the
              field and the card never spell the same date two ways
              (Requirement 13.6).
            */}
            <span className={cn("truncate", value === null && "text-ink-400")}>
              {value === null ? placeholder : formatDueDate(value, reference)}
            </span>

            <CalendarDays
              className="size-icon-md shrink-0 text-ink-400"
              strokeWidth={1.75}
              aria-hidden
            />
          </PopoverButton>
        ) : (
          /*
            `as={Fragment}` merges the popover's props onto the caller's own
            element. Rendering a wrapper instead would nest their button inside
            this one — invalid, and it would put the accessible name on the
            wrapper rather than the control the user focuses.
          */
          <PopoverButton as={Fragment}>{trigger}</PopoverButton>
        )}

        {/*
          `anchor` portals the panel and positions it against the viewport.
          Without it the calendar is clipped by the drawer's own scroll
          container — the same trap the tooltip fell into, where no `z-index`
          escapes an `overflow` ancestor (Requirement 13.4.1).
        */}
        <PopoverPanel
          transition
          anchor={{ to: "bottom start", gap: 4 }}
          aria-label={`Choose ${label.toLowerCase()}`}
          className={cn(
            "z-50 w-max rounded-lg bg-surface p-3 shadow-popover ring-1 ring-border",
            "transition duration-150 data-closed:scale-95 data-closed:opacity-0",
            "motion-reduce:transition-none motion-reduce:data-closed:scale-100",
            "focus:outline-none",
          )}
        >
          {({ close }) => (
            <>
              <div className="flex items-center justify-between gap-2 pb-2">
                <IconButton
                  icon={ChevronLeft}
                  label="Previous month"
                  size="xs"
                  {...propGetters.subtractOffset({ months: 1 })}
                />

                {/*
                  `aria-live` so paging announces the new month: with no text
                  field, this heading is the only thing that says where the
                  grid now is.
                */}
                <p
                  aria-live="polite"
                  className="text-sm font-semibold text-ink-900"
                >
                  {calendar?.month} {calendar?.year}
                </p>

                <IconButton
                  icon={ChevronRight}
                  label="Next month"
                  size="xs"
                  {...propGetters.addOffset({ months: 1 })}
                />
              </div>

              <div
                ref={gridRef}
                role="grid"
                aria-label={`${calendar?.month ?? ""} ${calendar?.year ?? ""}`}
                onKeyDown={handleGridKeyDown}
                className="flex flex-col"
              >
                <div role="row" className="flex">
                  {data.weekDays.map((weekDay) => (
                    <span
                      key={weekDay}
                      role="columnheader"
                      aria-label={weekDay}
                      className={cn(
                        "flex size-9 items-center justify-center",
                        "coarse-pointer:size-touch",
                        "text-xs font-medium text-ink-400",
                      )}
                    >
                      {weekDay}
                    </span>
                  ))}
                </div>

                {intoWeeks(days).map((week) => (
                  <div
                    // The first day uniquely identifies the week.
                    key={week[0]?.$date.toISOString() ?? ""}
                    role="row"
                    className="flex"
                  >
                    {week.map((day) => {
                      // `$date` is local midnight, so the key is read locally.
                      const iso = toDayKey(day.$date);
                      const isTabbable = iso === tabbableIso;

                      return (
                        <span key={iso} role="gridcell" className="flex">
                          <button
                            type="button"
                            /*
                             * The prop getter comes first so its `onClick` and
                             * `aria-selected` land, and our handler is handed
                             * to it through the config — where the library
                             * composes the two with `callAll` — rather than
                             * spread afterwards, which would replace it.
                             */
                            {...propGetters.dayButton(day, {
                              onClick: () => {
                                setFocusDay(iso);
                                /*
                                 * Picking a date is the whole purpose of the
                                 * panel, so it dismisses itself and returns
                                 * focus to the trigger.
                                 */
                                close();
                              },
                            })}
                            data-day={iso}
                            aria-label={dayLabel(day, iso === todayKey)}
                            aria-selected={day.selected}
                            /*
                             * Roving tabindex, and the same day gets
                             * `autoFocus`. The panel remounts on open and on
                             * every month change, so this is what lands focus
                             * inside the grid — a keyboard user should not
                             * have to Tab past the month controls to reach the
                             * only thing here that selects anything.
                             */
                            tabIndex={isTabbable ? 0 : -1}
                            autoFocus={isTabbable}
                            className={cn(
                              "flex size-9 items-center justify-center rounded-md text-sm",
                              "coarse-pointer:size-touch",
                              "transition-colors motion-reduce:transition-none",
                              "focus-visible:outline-brand-600 focus-visible:outline-2 focus-visible:outline-offset-1",
                              "can-hover:hover:bg-surface-hover",
                              day.inCurrentMonth
                                ? "text-ink-900"
                                : "text-ink-400",
                              /*
                               * Today is outlined, the selection is filled, so
                               * both read at once and neither is conveyed by
                               * colour alone.
                               *
                               * Today comes from the injected `now`, not the
                               * library's `day.now` — which reads the real
                               * clock and so ignored the prop, leaving the
                               * ring and the "Today" button on different days.
                               */
                              iso === todayKey &&
                                "ring-1 ring-inset ring-brand-600",
                              day.selected &&
                                "bg-brand-600 font-semibold text-white can-hover:hover:bg-brand-700",
                              day.disabled &&
                                "cursor-not-allowed text-ink-300 can-hover:hover:bg-transparent",
                            )}
                          >
                            {day.day}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    /*
                     * Built from the day key rather than the instant, so
                     * "Today" means the same day the board calls today.
                     */
                    const today = fromDayKey(todayKey);

                    if (today === null) return;

                    setOffsetDate(today);
                    setFocusDay(todayKey);
                    onChange(toDueDateIso(today));
                    close();
                  }}
                >
                  Today
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={value === null}
                  onClick={() => {
                    onChange(null);
                    close();
                  }}
                >
                  Clear
                </Button>
              </div>
            </>
          )}
        </PopoverPanel>
      </Popover>

      {/*
        Clearing sits outside the popover as well as inside it. Having to open
        a calendar to remove a date is the kind of small indignity that makes a
        field feel heavy, and it is one tap on touch.
      */}
      {value !== null && !disabled && !hideClear && (
        <IconButton
          icon={X}
          label={`Clear ${label.toLowerCase()}`}
          size="xs"
          onClick={() => {
            onChange(null);
          }}
        />
      )}
    </div>
  );
}

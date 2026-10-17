import { describe, expect, it } from "vitest";

import {
  dueDateAtDays,
  dueDateToDayKey,
  fromDayKey,
  toDayKey,
  toDueDateIso,
} from "./date";

/**
 * Calendar-day conversions.
 *
 * These exist because of a real off-by-one: `@rehookify/datepicker` represents
 * a day as *local midnight*, and reading one of its dates with `getUTC*`
 * produced the previous day for anyone east of Greenwich. A cell labelled
 * "November 4" carried the key `2026-11-03`.
 *
 * The suite is pinned to `TZ=Asia/Kolkata` (UTC+5:30) in the `test` script.
 * Under UTC every one of these passes either way, which is exactly why the bug
 * survived being written — and a half-hour offset also catches the sloppier
 * assumption that timezone offsets are whole hours.
 */

describe("the test environment is not UTC", () => {
  /*
   * Asserted rather than assumed. If someone drops the `TZ` setting, these
   * tests quietly stop testing the thing they exist for, so this fails loudly
   * instead.
   */
  it("runs in a timezone with a non-zero offset", () => {
    expect(new Date(2026, 9, 16).getTimezoneOffset()).not.toBe(0);
  });
});

describe("toDayKey", () => {
  it("reads the local calendar day, not the UTC one", () => {
    // Local midnight on 4 November. In UTC this instant is 3 November 18:30,
    // so a UTC-based reading would name the wrong day.
    const localMidnight = new Date(2026, 10, 4);

    expect(toDayKey(localMidnight)).toBe("2026-11-04");
    expect(localMidnight.toISOString().slice(0, 10)).toBe("2026-11-03");
  });

  it("zero-pads months and days", () => {
    expect(toDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("fromDayKey", () => {
  it("round-trips with toDayKey", () => {
    for (const key of ["2026-01-01", "2026-02-28", "2026-11-04", "2026-12-31"]) {
      const date = fromDayKey(key);

      expect(date).not.toBeNull();
      expect(toDayKey(date as Date)).toBe(key);
    }
  });

  it("returns a local-midnight date", () => {
    const date = fromDayKey("2026-11-04") as Date;

    expect(date.getHours()).toBe(0);
    expect(date.getDate()).toBe(4);
  });

  /*
   * `new Date("2026-02-31")` rolls into March rather than failing. A due date
   * a month away from what was typed is worse than a rejected edit.
   */
  it("rejects dates that do not exist instead of rolling over", () => {
    expect(fromDayKey("2026-02-31")).toBeNull();
    expect(fromDayKey("2026-13-01")).toBeNull();
    expect(fromDayKey("2026-04-31")).toBeNull();
  });

  it("accepts a real leap day and rejects a fake one", () => {
    expect(fromDayKey("2028-02-29")).not.toBeNull();
    expect(fromDayKey("2026-02-29")).toBeNull();
  });

  it("rejects anything that is not strictly YYYY-MM-DD", () => {
    for (const bad of [
      "",
      "next tuesday",
      "2026-1-1",
      "26-01-01",
      "2026/01/01",
      "2026-01-01T09:00:00Z",
    ]) {
      expect(fromDayKey(bad)).toBeNull();
    }
  });
});

describe("toDueDateIso", () => {
  it("maps a local calendar day to 09:00 UTC on that same day", () => {
    expect(toDueDateIso(new Date(2026, 10, 4))).toBe("2026-11-04T09:00:00.000Z");
  });

  /*
   * The property that matters: the day a user picks is the day that gets
   * stored, whatever the timezone. 09:00 UTC is far enough from both midnights
   * to survive every real offset.
   */
  it("never shifts the day", () => {
    for (const key of ["2026-01-01", "2026-06-15", "2026-11-04", "2026-12-31"]) {
      const stored = toDueDateIso(fromDayKey(key) as Date);

      expect(dueDateToDayKey(stored)).toBe(key);
    }
  });

  it("agrees with the quick-action presets", () => {
    // Both paths must produce the same instant for the same day, or the card
    // menu and the calendar would write different values (Requirement 5.4).
    const viaPreset = dueDateAtDays("2026-11-01T09:00:00.000Z", 3);
    const viaCalendar = toDueDateIso(fromDayKey("2026-11-04") as Date);

    expect(viaPreset).toBe(viaCalendar);
  });
});

describe("dueDateToDayKey", () => {
  it("reads the stored instant in UTC, matching the overdue calculation", () => {
    expect(dueDateToDayKey("2026-11-04T09:00:00.000Z")).toBe("2026-11-04");
  });

  it("round-trips a stored value back to the same calendar day", () => {
    const stored = "2026-11-04T09:00:00.000Z";
    const key = dueDateToDayKey(stored);

    expect(toDueDateIso(fromDayKey(key) as Date)).toBe(stored);
  });
});

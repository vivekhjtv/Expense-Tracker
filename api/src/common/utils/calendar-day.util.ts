/**
 * Plain calendar days ("YYYY-MM-DD") and months ("YYYY-MM").
 *
 * Some facts are about a DAY, not an instant: which day milk was delivered is
 * one of them. Storing such a fact as a `Date` forces it through a timezone on
 * the way in and out, and midnight UTC is already the previous day for anyone
 * west of Greenwich — the one error this data cannot tolerate. A calendar day
 * string has no instant to get wrong, and because ISO dates sort
 * lexicographically it still range-queries and indexes like a date.
 */

export const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const CALENDAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** True only for a day that actually exists — 2026-02-31 does not. */
export function isCalendarDay(value: string): boolean {
  if (!CALENDAR_DAY_PATTERN.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;

  // Day 0 of the NEXT month is the last day of this one, in every calendar
  // including leap Februaries.
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isCalendarMonth(value: string): boolean {
  if (!CALENDAR_MONTH_PATTERN.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

/** The month a day belongs to: "2026-09-12" -> "2026-09". */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/**
 * Half-open bounds for a month, as day strings: [first, firstOfNextMonth).
 *
 * Half-open rather than first..last so no caller has to know how long the
 * month is, and so a stray "2026-09-31" in the data cannot escape the range.
 */
export function monthBounds(month: string): { from: string; until: string } {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5));
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;

  return {
    from: `${month}-01`,
    until: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

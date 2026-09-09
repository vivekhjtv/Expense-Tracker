/**
 * Date-range presets for the ledger filters and dashboard.
 *
 * "Today" is a local-calendar concept, but Mongo stores UTC instants. At
 * 00:30 IST the UTC day is still yesterday, so a naive UTC range silently
 * drops the user's late-night spends from "Today". Every boundary here is
 * therefore computed against an explicit client offset (minutes east of UTC,
 * i.e. what `-new Date().getTimezoneOffset()` returns; 330 for IST).
 */

export enum DateRangePreset {
  TODAY = 'TODAY',
  YESTERDAY = 'YESTERDAY',
  THIS_WEEK = 'THIS_WEEK',
  THIS_MONTH = 'THIS_MONTH',
  LAST_MONTH = 'LAST_MONTH',
  THIS_YEAR = 'THIS_YEAR',
  ALL = 'ALL',
  CUSTOM = 'CUSTOM',
}

export const DATE_RANGE_PRESETS = Object.values(DateRangePreset);

/** Minutes east of UTC. India Standard Time. */
export const DEFAULT_TZ_OFFSET_MINUTES = 330;

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

/** Start of the local calendar day containing `instant`, as a UTC instant. */
function startOfLocalDay(instant: Date, offsetMinutes: number): Date {
  const shifted = instant.getTime() + offsetMinutes * MINUTE;
  const flooredLocal = Math.floor(shifted / DAY) * DAY;
  return new Date(flooredLocal - offsetMinutes * MINUTE);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}

/** Local calendar parts of an instant, for month/year arithmetic. */
function localParts(instant: Date, offsetMinutes: number) {
  const shifted = new Date(instant.getTime() + offsetMinutes * MINUTE);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/** Local midnight of a given local Y/M/D, as a UTC instant. */
function localMidnight(year: number, month: number, day: number, offsetMinutes: number): Date {
  return new Date(Date.UTC(year, month, day) - offsetMinutes * MINUTE);
}

/**
 * Resolves a preset into a half-open [from, to) instant range.
 * Half-open matters: a transaction stamped exactly at midnight must belong to
 * exactly one day, never to both.
 */
export function resolveDateRange(
  preset: DateRangePreset,
  offsetMinutes: number = DEFAULT_TZ_OFFSET_MINUTES,
  custom?: { from?: Date | string | null; to?: Date | string | null },
  now: Date = new Date(),
): DateRange {
  const todayStart = startOfLocalDay(now, offsetMinutes);
  const { year, month, weekday } = localParts(now, offsetMinutes);

  switch (preset) {
    case DateRangePreset.TODAY:
      return { from: todayStart, to: addDays(todayStart, 1) };

    case DateRangePreset.YESTERDAY:
      return { from: addDays(todayStart, -1), to: todayStart };

    case DateRangePreset.THIS_WEEK: {
      // Week starts Monday — the Indian/ISO convention, not Sunday.
      const daysSinceMonday = (weekday + 6) % 7;
      const weekStart = addDays(todayStart, -daysSinceMonday);
      return { from: weekStart, to: addDays(weekStart, 7) };
    }

    case DateRangePreset.THIS_MONTH:
      return {
        from: localMidnight(year, month, 1, offsetMinutes),
        to: localMidnight(year, month + 1, 1, offsetMinutes),
      };

    case DateRangePreset.LAST_MONTH:
      return {
        from: localMidnight(year, month - 1, 1, offsetMinutes),
        to: localMidnight(year, month, 1, offsetMinutes),
      };

    case DateRangePreset.THIS_YEAR:
      return {
        from: localMidnight(year, 0, 1, offsetMinutes),
        to: localMidnight(year + 1, 0, 1, offsetMinutes),
      };

    case DateRangePreset.CUSTOM: {
      const from = custom?.from ? startOfLocalDay(new Date(custom.from), offsetMinutes) : null;
      // `to` is inclusive of the whole day the user picked, so advance one day
      // to keep the range half-open.
      const to = custom?.to ? addDays(startOfLocalDay(new Date(custom.to), offsetMinutes), 1) : null;
      return { from, to };
    }

    case DateRangePreset.ALL:
    default:
      return { from: null, to: null };
  }
}

/** Builds the Mongo `date` filter clause, or undefined for an unbounded range. */
export function toDateFilter(range: DateRange): { $gte?: Date; $lt?: Date } | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { $gte: range.from } : {}),
    ...(range.to ? { $lt: range.to } : {}),
  };
}

/**
 * Formats a minutes-east-of-UTC offset as the "+05:30" string MongoDB's
 * `$dateToString`/`$dateTrunc` `timezone` option expects, so day-bucketing in
 * an aggregation lands on the same boundaries as the filters above.
 */
export function toUtcOffsetString(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/** Every local calendar day in [from, to), as YYYY-MM-DD keys. */
export function eachLocalDay(range: DateRange, offsetMinutes: number): string[] {
  if (!range.from || !range.to) return [];
  const days: string[] = [];
  for (
    let cursor = range.from.getTime();
    cursor < range.to.getTime();
    cursor += DAY
  ) {
    days.push(new Date(cursor + offsetMinutes * MINUTE).toISOString().slice(0, 10));
  }
  return days;
}

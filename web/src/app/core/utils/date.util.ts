/**
 * Conversions between `<input type="date">` values and API ISO strings.
 *
 * The whole point of this file is that `new Date('2026-09-09')` parses as
 * MIDNIGHT UTC, which in IST is 5:30am on the 9th — but in any negative-offset
 * timezone it is the 8th. Round-tripping a date through the naive path can
 * therefore shift a user's expense to the previous day. Everything here works
 * in explicit local-calendar parts instead.
 */

/** Local calendar date as YYYY-MM-DD, which is what a date input expects. */
export function toDateInputValue(value: Date | string = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return toDateInputValue(new Date());
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Turns a YYYY-MM-DD input value into an ISO instant.
 *
 * If the user picked today we stamp the current time, which is both more
 * accurate and makes today's entries sort in the order they were added. Any
 * other day gets local noon — far enough from both midnights that no timezone
 * conversion can move it onto a neighbouring date.
 */
export function toIsoFromDateInput(dateInputValue: string): string {
  const [year, month, day] = dateInputValue.split('-').map(Number);
  if (!year || !month || !day) {
    return new Date().toISOString();
  }

  const now = new Date();
  const isToday =
    now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;

  const local = isToday ? now : new Date(year, month - 1, day, 12, 0, 0, 0);

  return local.toISOString();
}

export function isFutureDate(dateInputValue: string): boolean {
  const [year, month, day] = dateInputValue.split('-').map(Number);
  if (!year || !month || !day) return false;
  const picked = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return picked.getTime() > today.getTime();
}

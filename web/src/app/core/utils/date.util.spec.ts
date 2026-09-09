import { describe, expect, it } from 'vitest';
import { isFutureDate, toDateInputValue, toIsoFromDateInput } from './date.util';

describe('date.util', () => {
  it('formats a Date as the local calendar day', () => {
    expect(toDateInputValue(new Date(2026, 8, 9, 23, 30))).toBe('2026-09-09');
  });

  it('does NOT shift the day when parsing an ISO instant', () => {
    // The API anchors scanned dates at midday UTC precisely so this holds in
    // every timezone. Midnight UTC would land on the 4th west of Greenwich.
    expect(toDateInputValue('2026-09-05T12:00:00.000Z')).toBe('2026-09-05');
  });

  it('round-trips a past date without drifting across midnight', () => {
    const iso = toIsoFromDateInput('2026-01-15');
    expect(toDateInputValue(iso)).toBe('2026-01-15');
  });

  it('round-trips every day of a year in the local timezone', () => {
    // A single hardcoded date can pass by luck; a DST boundary is where a
    // naive implementation actually breaks.
    for (let day = 0; day < 365; day++) {
      const date = new Date(2026, 0, 1 + day);
      const input = toDateInputValue(date);
      expect(toDateInputValue(toIsoFromDateInput(input))).toBe(input);
    }
  });

  it('stamps the current time when the picked day is today', () => {
    const today = toDateInputValue(new Date());
    const iso = new Date(toIsoFromDateInput(today));
    expect(Math.abs(iso.getTime() - Date.now())).toBeLessThan(2000);
  });

  it('uses local noon for any other day, far from both midnights', () => {
    expect(new Date(toIsoFromDateInput('2026-03-03')).getHours()).toBe(12);
  });

  it('falls back to today for a malformed value', () => {
    expect(toDateInputValue('not-a-date')).toBe(toDateInputValue(new Date()));
  });

  it('detects a future date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isFutureDate(toDateInputValue(tomorrow))).toBe(true);
    expect(isFutureDate(toDateInputValue(new Date()))).toBe(false);
  });
});

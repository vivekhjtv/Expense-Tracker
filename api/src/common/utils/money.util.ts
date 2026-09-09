/**
 * Money helpers.
 *
 * Balances and amounts are persisted as `Number` (rupees, 2dp) to match the
 * agreed schema, but every add/subtract is performed in integer minor units
 * (paise) and only then converted back. This removes IEEE-754 drift:
 *
 *   0.1 + 0.2            === 0.30000000000000004   // never do this to a ledger
 *   addMoney(0.1, 0.2)   === 0.3
 *
 * Rule for the codebase: no `+`, `-` or `*` directly on a money value.
 */

const MINOR_UNITS = 100;

/** Largest value we accept, chosen so paise math stays inside Number.MAX_SAFE_INTEGER. */
export const MAX_MONEY = 1_000_000_000_000;

export function toMinor(amount: number): number {
  return Math.round(amount * MINOR_UNITS);
}

export function fromMinor(minor: number): number {
  return minor / MINOR_UNITS;
}

/** Snaps a float to a clean 2dp money value. */
export function roundMoney(amount: number): number {
  return fromMinor(toMinor(amount));
}

export function addMoney(...amounts: number[]): number {
  return fromMinor(amounts.reduce((sum, amount) => sum + toMinor(amount), 0));
}

export function subtractMoney(from: number, ...amounts: number[]): number {
  return fromMinor(amounts.reduce((rest, amount) => rest - toMinor(amount), toMinor(from)));
}

/** price * qty, kept exact for the common 2dp-price / integer-qty case. */
export function multiplyMoney(amount: number, factor: number): number {
  return fromMinor(Math.round(toMinor(amount) * factor));
}

export function sumMoney(amounts: number[]): number {
  return addMoney(...amounts);
}

export function isSameMoney(a: number, b: number): boolean {
  return toMinor(a) === toMinor(b);
}

/** True when the two values differ by more than `tolerance` rupees. */
export function differsBeyond(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(toMinor(a) - toMinor(b)) > toMinor(tolerance);
}

export function isValidMoney(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_MONEY
  );
}

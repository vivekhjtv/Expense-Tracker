/**
 * Client-side mirror of the API's money discipline: add in integer paise,
 * never in floats. The line-items total is shown to the user next to the
 * amount they are about to save, so `0.1 + 0.2 = 0.30000000000000004`
 * would be visible on screen, not just wrong internally.
 */

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumMoney(values: number[]): number {
  return values.reduce((paise, value) => paise + Math.round(value * 100), 0) / 100;
}

export function multiplyMoney(price: number, qty: number): number {
  return Math.round(Math.round(price * 100) * qty) / 100;
}

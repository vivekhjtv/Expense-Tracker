import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats money in Indian digit grouping — ₹1,23,456.78, not ₹123,456.78.
 * `Intl` with the en-IN locale gets the lakh/crore grouping right, which the
 * default currency pipe configuration would not.
 */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  private static readonly withPaise = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  private static readonly whole = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  /**
   * @param showPaise when false, rounds to whole rupees — used on dashboard
   *        headline figures where two decimals are noise at a glance.
   */
  transform(value: number | null | undefined, showPaise = true): string {
    const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return showPaise ? InrPipe.withPaise.format(amount) : InrPipe.whole.format(amount);
  }
}

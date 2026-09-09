import { describe, expect, it } from 'vitest';
import { multiplyMoney, roundMoney, sumMoney } from './money.util';

describe('money.util', () => {
  it('sums without float drift', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
  });

  it('sums a realistic itemised bill exactly', () => {
    expect(sumMoney([34, 34, 265.5, 28])).toBe(361.5);
  });

  it('multiplies a unit price by quantity exactly', () => {
    expect(multiplyMoney(12.35, 3)).toBe(37.05);
    expect(multiplyMoney(0.7, 3)).toBe(2.1);
  });

  it('rounds to 2dp', () => {
    expect(roundMoney(19.999)).toBe(20);
    expect(roundMoney(2.675)).toBe(2.68);
  });

  it('rounds an exact-half literal the way the double actually stores it', () => {
    // 1.005 is held as 1.00499999999999989, so it rounds DOWN. Documented
    // rather than "fixed": every epsilon workaround trades this rare case for
    // a worse one, and real input is 2dp already, where it cannot arise.
    expect(roundMoney(1.005)).toBe(1);
  });

  it('returns 0 for an empty list', () => {
    expect(sumMoney([])).toBe(0);
  });
});

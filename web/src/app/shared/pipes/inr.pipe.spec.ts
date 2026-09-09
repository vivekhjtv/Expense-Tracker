import { describe, expect, it } from 'vitest';
import { InrPipe } from './inr.pipe';

describe('InrPipe', () => {
  const pipe = new InrPipe();

  it('uses Indian lakh grouping, not thousands grouping', () => {
    // ₹1,23,456.78 — the grouping an Indian user expects. The default
    // currency formatting would render ₹123,456.78.
    expect(pipe.transform(123456.78)).toContain('1,23,456.78');
  });

  it('formats crores correctly', () => {
    expect(pipe.transform(12345678)).toContain('1,23,45,678');
  });

  it('drops paise when asked', () => {
    expect(pipe.transform(1234.56, false)).not.toContain('.');
  });

  it('renders null and undefined as zero rather than blank', () => {
    expect(pipe.transform(null)).toContain('0.00');
    expect(pipe.transform(undefined)).toContain('0.00');
  });

  it('survives NaN', () => {
    expect(pipe.transform(Number.NaN)).toContain('0.00');
  });
});

import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PaymentModeSlice } from '../../../core/models/analytics.model';
import { PAYMENT_COLORS } from '../../chart-palette';
import { SplitBar } from './split-bar';

describe('SplitBar', () => {
  let fixture: ComponentFixture<SplitBar>;
  let component: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplitBar],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(SplitBar);
    component = fixture.componentInstance;
  });

  const render = (slices: Partial<PaymentModeSlice>[]) => {
    fixture.componentRef.setInput('slices', slices);
    fixture.detectChanges();
  };

  it('always renders both modes, even when one is zero', () => {
    // A donut that drops from two slices to one between months is
    // disorienting; the layout must stay stable.
    render([{ paymentMode: 'CASH', total: 500, count: 2, sharePct: 100 }]);
    expect(component.parts().length).toBe(2);
    expect(component.parts()[1].slice.total).toBe(0);
  });

  it('puts cash first and online second, consistently', () => {
    render([
      { paymentMode: 'ONLINE_BANKING', total: 700, count: 3, sharePct: 70 },
      { paymentMode: 'CASH', total: 300, count: 2, sharePct: 30 },
    ]);
    expect(component.parts().map((p: any) => p.mode)).toEqual(['CASH', 'ONLINE_BANKING']);
  });

  it('uses the validated colour for each mode', () => {
    render([{ paymentMode: 'CASH', total: 100, count: 1, sharePct: 100 }]);
    expect(component.parts()[0].color).toBe(PAYMENT_COLORS.CASH);
    expect(component.parts()[1].color).toBe(PAYMENT_COLORS.ONLINE_BANKING);
  });

  it('computes percentages that sum to 100', () => {
    render([
      { paymentMode: 'CASH', total: 250, count: 1, sharePct: 25 },
      { paymentMode: 'ONLINE_BANKING', total: 750, count: 1, sharePct: 75 },
    ]);
    const [cash, online] = component.parts();
    expect(cash.pct).toBe(25);
    expect(online.pct).toBe(75);
  });

  it('does not divide by zero on an empty period', () => {
    render([]);
    expect(component.total()).toBe(0);
    expect(component.parts().every((p: any) => p.pct === 0)).toBe(true);
  });
});

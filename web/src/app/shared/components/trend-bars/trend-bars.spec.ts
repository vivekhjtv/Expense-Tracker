import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DailyPoint } from '../../../core/models/analytics.model';
import { TrendBars } from './trend-bars';

const days = (totals: number[]): DailyPoint[] =>
  totals.map((total, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    total,
    count: total > 0 ? 1 : 0,
  }));

describe('TrendBars', () => {
  let fixture: ComponentFixture<TrendBars>;
  let component: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrendBars],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(TrendBars);
    component = fixture.componentInstance;
  });

  const render = (points: DailyPoint[]) => {
    fixture.componentRef.setInput('points', points);
    fixture.detectChanges();
  };

  it('renders one bar per day, including zero days', () => {
    render(days([100, 0, 250, 0, 50]));
    expect(component.bars().length).toBe(5);
  });

  it('gives a zero day no height rather than a stub bar', () => {
    render(days([100, 0]));
    expect(component.bars()[1].height).toBe(0);
  });

  it('scales bar height against the period maximum', () => {
    render(days([100, 50]));
    const [tallest, half] = component.bars();
    expect(half.height).toBeCloseTo(tallest.height / 2, 1);
  });

  it('caps bar thickness so it never fills its slot', () => {
    render(days([10, 20]));
    // Two bars across 340px would otherwise be ~170px wide blocks.
    expect(component.bars()[0].width).toBeLessThanOrEqual(24);
  });

  it('keeps every bar inside the plot area', () => {
    render(days(Array.from({ length: 31 }, (_, i) => i * 37)));
    for (const bar of component.bars()) {
      expect(bar.y).toBeGreaterThanOrEqual(0);
      expect(bar.y + bar.height).toBeLessThanOrEqual(110.001);
      expect(bar.x).toBeGreaterThanOrEqual(0);
      expect(bar.x + bar.width).toBeLessThanOrEqual(340.001);
    }
  });

  it('identifies the peak day', () => {
    render(days([100, 900, 50]));
    expect(component.peak().total).toBe(900);
  });

  it('labels selectively — never one label per day', () => {
    render(days(Array.from({ length: 31 }, () => 100)));
    expect(component.ticks().length).toBeLessThanOrEqual(3);
  });

  it('toggles a tapped bar on and off', () => {
    render(days([100, 200]));
    const bar = component.bars()[1];
    component.toggle(bar);
    expect(component.selected().point.total).toBe(200);
    component.toggle(bar);
    expect(component.selected()).toBeNull();
  });

  it('survives an all-zero period without dividing by zero', () => {
    render(days([0, 0, 0]));
    expect(component.max()).toBe(1);
    expect(component.bars().every((b: any) => b.height === 0)).toBe(true);
  });

  it('renders nothing for an empty range', () => {
    render([]);
    expect(component.bars()).toEqual([]);
    expect(component.peak()).toBeNull();
  });
});

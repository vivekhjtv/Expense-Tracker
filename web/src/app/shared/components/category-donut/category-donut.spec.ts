import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CategorySlice } from '../../../core/models/analytics.model';
import { CHART_OTHER, CHART_SERIES } from '../../chart-palette';
import { CategoryDonut } from './category-donut';

const slice = (category: string, total: number, sharePct: number): CategorySlice => ({
  category,
  total,
  count: 1,
  sharePct,
});

describe('CategoryDonut', () => {
  let fixture: ComponentFixture<CategoryDonut>;
  let component: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryDonut],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(CategoryDonut);
    component = fixture.componentInstance;
  });

  const render = (slices: CategorySlice[]) => {
    fixture.componentRef.setInput('slices', slices);
    fixture.detectChanges();
  };

  it('renders one segment per category', () => {
    render([slice('GROCERIES', 500, 50), slice('FUEL', 500, 50)]);
    expect(component.segments().length).toBe(2);
  });

  it('assigns palette slots in fixed order, never cycling', () => {
    render([
      slice('A', 60, 30),
      slice('B', 50, 25),
      slice('C', 40, 20),
      slice('D', 30, 15),
      slice('E', 20, 10),
    ]);
    expect(component.segments().map((s: any) => s.color)).toEqual(CHART_SERIES.slice(0, 5));
  });

  it('folds everything past five into a neutral Other bucket', () => {
    // Past six segments adjacent arcs blur; a seventh generated hue would be
    // indistinguishable under colour-vision deficiency.
    render([
      slice('A', 60, 25),
      slice('B', 50, 21),
      slice('C', 40, 17),
      slice('D', 30, 12),
      slice('E', 20, 8),
      slice('F', 15, 6),
      slice('G', 10, 4),
      slice('H', 5, 2),
    ]);
    const segments = component.segments();
    expect(segments.length).toBe(6);

    const other = segments[5];
    expect(other.color).toBe(CHART_OTHER);
    expect(other.label).toBe('Other (3)');
    expect(other.slice.total).toBe(30); // 15 + 10 + 5
  });

  it('lays segments end to end around the ring with no overlap', () => {
    render([slice('A', 750, 75), slice('B', 250, 25)]);
    const [first, second] = component.segments();
    const circumference = 2 * Math.PI * 52;

    expect(first.offset).toBe(-0);
    // Second starts exactly where the first ends.
    expect(second.offset).toBeCloseTo(-(circumference * 0.75), 5);
    // dash + gap always covers the full circle, so no segment repeats.
    expect(first.dash + first.gap).toBeCloseTo(circumference, 5);
  });

  it('leaves a surface gap between segments rather than drawing borders', () => {
    render([slice('A', 500, 50), slice('B', 500, 50)]);
    const circumference = 2 * Math.PI * 52;
    // Half the ring minus the 3px gap.
    expect(component.segments()[0].dash).toBeCloseTo(circumference / 2 - 3, 5);
  });

  it('never produces a negative dash for a tiny slice', () => {
    render([slice('BIG', 99999, 99.9), slice('TINY', 1, 0.1)]);
    for (const segment of component.segments()) {
      expect(segment.dash).toBeGreaterThanOrEqual(0);
    }
  });

  it('ignores zero-value categories', () => {
    render([slice('A', 100, 100), slice('B', 0, 0)]);
    expect(component.segments().length).toBe(1);
  });

  it('handles an empty period without dividing by zero', () => {
    render([]);
    expect(component.segments()).toEqual([]);
    expect(component.total()).toBe(0);
    expect(component.ariaLabel()).toBe('No spending recorded');
  });

  it('totals without float drift', () => {
    render([slice('A', 0.1, 50), slice('B', 0.2, 50)]);
    expect(component.total()).toBe(0.3);
  });
});

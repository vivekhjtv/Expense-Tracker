import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MilkEntry, MilkMonth } from '../../core/models/milk.model';
import { MilkService } from '../../core/services/milk.service';
import { Milk } from './milk';

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const TODAY = new Date();
const TODAY_KEY = dayKey(TODAY);
const THIS_MONTH = TODAY_KEY.slice(0, 7);

const entry = (date: string, quantity: number): MilkEntry =>
  ({ _id: date, date, quantity, createdAt: '', updatedAt: '' }) as MilkEntry;

const monthOf = (entries: MilkEntry[], month = THIS_MONTH): MilkMonth => {
  const totalLitres = entries.reduce((sum, e) => sum + e.quantity, 0);
  return {
    month,
    entries,
    summary: {
      totalLitres,
      daysRecorded: entries.length,
      averageLitres: entries.length ? totalLitres / entries.length : 0,
    },
  };
};

describe('Milk', () => {
  let fixture: ComponentFixture<Milk>;
  let component: any;
  let milk: {
    month: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  /** toObservable feeds the fetch through an effect, which flushes on CD. */
  const settle = async () => {
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 10));
    fixture.detectChanges();
  };

  const setup = async (entries: MilkEntry[] = []) => {
    milk = {
      month: vi.fn((month: string) => of(monthOf(entries, month))),
      save: vi.fn((date: string, quantity: number) => of(entry(date, quantity))),
      remove: vi.fn(() => of({ message: 'ok' })),
    };

    await TestBed.configureTestingModule({
      imports: [Milk],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MilkService, useValue: milk },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Milk);
    component = fixture.componentInstance;
    await settle();
  };

  describe('the month grid', () => {
    it('pads the first week so day 1 lands on its real weekday', async () => {
      await setup();
      const [year, month] = THIS_MONTH.split('-').map(Number);
      const firstWeekday = new Date(year, month - 1, 1).getDay();
      const daysInMonth = new Date(year, month, 0).getDate();

      const cells = component.cells();
      expect(cells.length).toBe(firstWeekday + daysInMonth);
      expect(cells.slice(0, firstWeekday).every((c: unknown) => c === null)).toBe(true);
      expect(cells[firstWeekday].day).toBe(1);
    });

    it('carries the litres onto the day they were recorded', async () => {
      await setup([entry(TODAY_KEY, 1.5)]);
      const today = component.cells().find((c: any) => c?.date === TODAY_KEY);
      expect(today.quantity).toBe(1.5);
      expect(today.isToday).toBe(true);
    });

    it('leaves an unrecorded day empty rather than showing a zero', async () => {
      await setup([]);
      const today = component.cells().find((c: any) => c?.date === TODAY_KEY);
      // null, not 0: nobody logged that day, which is not the same as no milk.
      expect(today.quantity).toBeNull();
    });

    it('marks days after today so they cannot be logged', async () => {
      await setup();
      const future = component.cells().filter((c: any) => c && c.date > TODAY_KEY);
      expect(future.every((c: any) => c.isFuture)).toBe(true);
    });
  });

  describe('paging months', () => {
    it('asks the API for the month on screen', async () => {
      await setup();
      expect(milk.month).toHaveBeenCalledWith(THIS_MONTH);

      component.prevMonth();
      await settle();
      expect(milk.month.mock.calls.at(-1)![0]).toBe(component.month());
      expect(component.month() < THIS_MONTH).toBe(true);
    });

    it('will not page into the future — there is nothing there', async () => {
      await setup();
      expect(component.canGoNext()).toBe(false);

      component.nextMonth();
      expect(component.month()).toBe(THIS_MONTH);

      component.prevMonth();
      expect(component.canGoNext()).toBe(true);
      component.nextMonth();
      expect(component.month()).toBe(THIS_MONTH);
    });

    it('crosses a year boundary correctly', async () => {
      await setup();
      component.month.set('2026-01');
      expect(component.cells().filter(Boolean).length).toBe(31);

      component.prevMonth();
      expect(component.month()).toBe('2025-12');
      component.nextMonth();
      expect(component.month()).toBe('2026-01');
    });
  });

  describe('selecting a day', () => {
    it('starts on today', async () => {
      await setup();
      expect(component.selectedDate()).toBe(TODAY_KEY);
    });

    it('follows a selection into another month, so the pick stays visible', async () => {
      await setup();
      component.month.set('2026-01');
      component.selectDay('2026-01-09');
      await settle();

      expect(component.selectedDate()).toBe('2026-01-09');
      expect(component.month()).toBe('2026-01');
      expect(component.selectionIsVisible()).toBe(true);
    });

    it('does not claim a day is empty when its month is not on screen', async () => {
      await setup([entry(TODAY_KEY, 2)]);
      component.prevMonth();
      await settle();

      // The loaded month no longer holds today, so the screen must not answer
      // for it either way.
      expect(component.selectionIsVisible()).toBe(false);

      component.showSelectedMonth();
      await settle();
      expect(component.month()).toBe(THIS_MONTH);
      expect(component.selectionIsVisible()).toBe(true);
      expect(component.selectedQuantity()).toBe(2);
    });

    it('refuses a future day', async () => {
      await setup();
      const tomorrow = new Date(TODAY);
      tomorrow.setDate(tomorrow.getDate() + 1);

      component.selectDay(dayKey(tomorrow));
      expect(component.selectedDate()).toBe(TODAY_KEY);
    });
  });

  describe('recording', () => {
    it('saves the tapped quantity against the selected day', async () => {
      await setup();
      component.record(1.5);
      expect(milk.save).toHaveBeenCalledWith(TODAY_KEY, 1.5);
    });

    it('re-reads the month afterwards, so the grid shows the new figure', async () => {
      await setup();
      const before = milk.month.mock.calls.length;
      component.record(1);
      await settle();
      expect(milk.month.mock.calls.length).toBe(before + 1);
    });

    it('shows the day’s current quantity as the chosen one', async () => {
      await setup([entry(TODAY_KEY, 2)]);
      expect(component.selectedQuantity()).toBe(2);
    });

    it('ignores a second tap while one is still in flight', async () => {
      await setup();
      component.saving.set(true);
      component.record(1);
      expect(milk.save).not.toHaveBeenCalled();
    });
  });

  describe('removing', () => {
    it('clears the selected day', async () => {
      await setup([entry(TODAY_KEY, 1)]);
      component.removeSelected();
      expect(milk.remove).toHaveBeenCalledWith(TODAY_KEY);
    });

    it('does nothing on a day that holds no entry', async () => {
      await setup([]);
      component.removeSelected();
      expect(milk.remove).not.toHaveBeenCalled();
    });
  });
});

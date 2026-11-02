import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusEntry, BusMonth } from '../../core/models/bus.model';
import { BusService } from '../../core/services/bus.service';
import { Bus } from './bus';

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const TODAY = new Date();
const TODAY_KEY = dayKey(TODAY);
const THIS_MONTH = TODAY_KEY.slice(0, 7);

const entry = (date: string, price: number): BusEntry =>
  ({ _id: date, date, price, createdAt: '', updatedAt: '' }) as BusEntry;

const monthOf = (entries: BusEntry[], month = THIS_MONTH): BusMonth => {
  const totalAmount = entries.reduce((sum, e) => sum + e.price, 0);
  return {
    month,
    entries,
    summary: {
      totalAmount,
      daysRecorded: entries.length,
      averageAmount: entries.length ? totalAmount / entries.length : 0,
    },
  };
};

describe('Bus', () => {
  let fixture: ComponentFixture<Bus>;
  let component: any;
  let busService: {
    month: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const settle = async () => {
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 10));
    fixture.detectChanges();
  };

  const setup = async (entries: BusEntry[] = []) => {
    busService = {
      month: vi.fn((month: string) => of(monthOf(entries, month))),
      save: vi.fn((date: string, price: number) => of(entry(date, price))),
      remove: vi.fn(() => of({ message: 'ok' })),
    };

    await TestBed.configureTestingModule({
      imports: [Bus],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: BusService, useValue: busService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Bus);
    component = fixture.componentInstance;
    await settle();
  };

  it('mounts onto today in the current month', async () => {
    await setup();
    expect(component.selectedDate()).toBe(TODAY_KEY);
    expect(component.month()).toBe(THIS_MONTH);
  });

  it('renders days in the month and maps recorded bus ticket prices', async () => {
    const d1 = `${THIS_MONTH}-02`;
    const d2 = `${THIS_MONTH}-05`;
    await setup([entry(d1, 25), entry(d2, 50)]);

    const c1 = component.cells().find((c: any) => c?.date === d1);
    expect(c1?.price).toBe(25);

    const c2 = component.cells().find((c: any) => c?.date === d2);
    expect(c2?.price).toBe(50);
  });

  it('calculates monthly summary correctly', async () => {
    const d1 = `${THIS_MONTH}-01`;
    const d2 = `${THIS_MONTH}-02`;
    await setup([entry(d1, 30), entry(d2, 70)]);

    expect(component.summary()?.totalAmount).toBe(100);
    expect(component.summary()?.daysRecorded).toBe(2);
    expect(component.summary()?.averageAmount).toBe(50);
  });

  it('saves quick fare directly when tapped', async () => {
    await setup();
    component.setQuickFare(30);

    expect(busService.save).toHaveBeenCalledWith(TODAY_KEY, 30);
  });

  it('saves manual ticket price when valid', async () => {
    await setup();
    component.ticketPriceInput.set('45.50');
    component.saveManualTicket();

    expect(busService.save).toHaveBeenCalledWith(TODAY_KEY, 45.5);
  });

  it('removes selected date entry', async () => {
    const d = `${THIS_MONTH}-02`;
    await setup([entry(d, 35)]);
    component.selectDay(d);
    await settle();

    component.removeSelected();
    expect(busService.remove).toHaveBeenCalledWith(d);
  });

  it('navigates previous and next month correctly', async () => {
    await setup();
    expect(component.canGoNext()).toBe(false);

    component.prevMonth();
    await settle();
    expect(component.canGoNext()).toBe(true);

    component.nextMonth();
    await settle();
    expect(component.month()).toBe(THIS_MONTH);
  });
});

import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Transaction } from '../../core/models/transaction.model';
import { TransactionService } from '../../core/services/transaction.service';
import { Ledger } from './ledger';

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    _id: Math.random().toString(36).slice(2),
    amount: 100, type: 'EXPENSE', paymentMode: 'CASH', category: 'GROCERIES',
    date: new Date().toISOString(),
    source: 'MANUAL', createdAt: '', updatedAt: '',
    ...over,
  }) as Transaction;

const isoDaysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

describe('Ledger', () => {
  let fixture: ComponentFixture<Ledger>;
  let component: any;
  let list: ReturnType<typeof vi.fn>;

  const setup = async (transactions: Transaction[]) => {
    list = vi.fn(() =>
      of({
        data: transactions,
        meta: { page: 1, limit: 25, total: transactions.length, totalPages: 1, hasMore: false },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [Ledger],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: TransactionService, useValue: { list, remove: vi.fn(() => of({ message: 'ok' })) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Ledger);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe('day grouping', () => {
    it('groups transactions under one header per day', async () => {
      await setup([
        tx({ date: isoDaysAgo(0) }), tx({ date: isoDaysAgo(0) }), tx({ date: isoDaysAgo(1) }),
      ]);
      const groups = component.groups();
      expect(groups.length).toBe(2);
      expect(groups[0].transactions.length).toBe(2);
    });

    it('labels the two most recent days in plain language', async () => {
      await setup([tx({ date: isoDaysAgo(0) }), tx({ date: isoDaysAgo(1) })]);
      expect(component.groups()[0].label).toBe('Today');
      expect(component.groups()[1].label).toBe('Yesterday');
    });

    it('subtotals only EXPENSE — income is not spending', async () => {
      await setup([
        tx({ date: isoDaysAgo(0), amount: 300, type: 'EXPENSE' }),
        tx({ date: isoDaysAgo(0), amount: 20000, type: 'INCOME' }),
      ]);
      // Counting the income would report ₹20,300 spent on a ₹300 day.
      expect(component.groups()[0].spent).toBe(300);
    });

    it('subtotals without float drift', async () => {
      await setup([
        tx({ date: isoDaysAgo(0), amount: 0.1 }), tx({ date: isoDaysAgo(0), amount: 0.2 }),
      ]);
      expect(component.groups()[0].spent).toBe(0.3);
    });

    it('preserves the API ordering rather than re-sorting', async () => {
      await setup([tx({ date: isoDaysAgo(0) }), tx({ date: isoDaysAgo(3) }), tx({ date: isoDaysAgo(7) })]);
      expect(component.groups().map((g: any) => g.label)[0]).toBe('Today');
    });
  });

  describe('filters', () => {
    it('counts only non-default filters as active', async () => {
      await setup([]);
      expect(component.activeFilterCount()).toBe(0);
      component.setPaymentMode('CASH');
      expect(component.activeFilterCount()).toBe(1);
    });

    it('sends the payment mode through to the API', async () => {
      await setup([]);
      list.mockClear();
      component.setPaymentMode('CASH');
      await new Promise((r) => setTimeout(r, 320));
      expect(list.mock.calls.at(-1)![0]).toMatchObject({ paymentMode: 'CASH' });
    });

    it('omits blank filters instead of sending empty values', async () => {
      await setup([]);
      const query = list.mock.calls[0][0];
      expect(query).not.toHaveProperty('paymentMode');
      expect(query).not.toHaveProperty('search');
      expect(query).not.toHaveProperty('category');
    });

    it('only sends custom dates when the range is CUSTOM', async () => {
      await setup([]);
      component.filters.patchValue({ from: '2026-01-01', to: '2026-01-31' });
      await new Promise((r) => setTimeout(r, 320));
      expect(list.mock.calls.at(-1)![0]).not.toHaveProperty('from');

      component.setRange('CUSTOM');
      await new Promise((r) => setTimeout(r, 320));
      expect(list.mock.calls.at(-1)![0]).toMatchObject({ from: '2026-01-01', to: '2026-01-31' });
    });

    it('resets back to defaults', async () => {
      await setup([]);
      component.setPaymentMode('CASH');
      component.resetFilters();
      expect(component.activeFilterCount()).toBe(0);
    });
  });

  describe('row expansion', () => {
    it('opens one row at a time', async () => {
      await setup([tx({ _id: 'a' }), tx({ _id: 'b' })]);
      component.toggleExpanded('a');
      expect(component.expandedId()).toBe('a');
      component.toggleExpanded('b');
      expect(component.expandedId()).toBe('b');
      component.toggleExpanded('b');
      expect(component.expandedId()).toBeNull();
    });

    it('totals line items exactly', async () => {
      const t = tx({ items: [{ name: 'Milk', price: 34, qty: 2 }, { name: 'Atta', price: 265.5, qty: 1 }] });
      await setup([t]);
      expect(component.itemsTotal(t)).toBe(333.5);
    });
  });
});

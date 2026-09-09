import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMode, TransactionType } from '../../core/models/enums';
import { ScannedReceipt } from '../../core/models/receipt.model';
import { ReceiptService } from '../../core/services/receipt.service';
import { TransactionService } from '../../core/services/transaction.service';
import { AddExpense } from './add-expense';

const receipt = (over: Partial<ScannedReceipt> = {}): ScannedReceipt => ({
  merchantName: 'Reliance Fresh',
  date: '2026-09-05T12:00:00.000Z',
  totalAmount: 379.58,
  subTotal: 361.5,
  taxAmount: 18.08,
  discountAmount: null,
  currency: 'INR',
  paymentMode: PaymentMode.ONLINE_BANKING,
  category: 'GROCERIES',
  notes: null,
  items: [
    { name: 'Amul Gold Milk 1L', price: 34, qty: 2 },
    { name: 'Aashirvaad Atta 5kg', price: 265.5, qty: 1 },
  ],
  confidence: 0.93,
  warnings: ['check the items'],
  meta: { model: 'gemini-2.5-flash', scannedAt: '', processingMs: 900, itemsTotal: 333.5 },
  ...over,
});

describe('AddExpense', () => {
  let fixture: ComponentFixture<AddExpense>;
  let component: any;
  let transactionService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    transactionService = {
      create: vi.fn(() => of({ _id: 'new' })),
      update: vi.fn(() => of({ _id: 'new' })),
      get: vi.fn(() => of({})),
    };

    await TestBed.configureTestingModule({
      imports: [AddExpense],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: TransactionService, useValue: transactionService },
        {
          provide: ReceiptService,
          useValue: { scan: () => of({ phase: 'done', receipt: receipt() }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddExpense);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('validation', () => {
    it('starts invalid because amount is required', () => {
      expect(component.form.invalid).toBe(true);
      expect(component.form.controls.amount.hasError('required')).toBe(true);
    });

    it('rejects zero and negative amounts', () => {
      component.form.controls.amount.setValue(0);
      expect(component.form.controls.amount.hasError('min')).toBe(true);
      component.form.controls.amount.setValue(-5);
      expect(component.form.controls.amount.hasError('min')).toBe(true);
      component.form.controls.amount.setValue(0.01);
      expect(component.form.controls.amount.valid).toBe(true);
    });

    it('is valid as soon as an amount is entered — nothing else is required', () => {
      // The whole point of dropping accounts: amount + mode + date, and mode
      // and date already have sensible defaults.
      component.form.controls.amount.setValue(250);
      expect(component.form.valid).toBe(true);
    });

    it('defaults to UPI/Card today, so a quick entry needs one field', () => {
      expect(component.form.controls.paymentMode.value).toBe(PaymentMode.ONLINE_BANKING);
      expect(component.form.controls.date.value).toBeTruthy();
    });
  });

  describe('patchFromScan', () => {
    it('hydrates scalar fields from the scan', () => {
      component.patchFromScan(receipt());
      const value = component.form.getRawValue();
      expect(value.amount).toBe(379.58);
      expect(value.category).toBe('GROCERIES');
      expect(value.paymentMode).toBe(PaymentMode.ONLINE_BANKING);
      expect(value.merchantName).toBe('Reliance Fresh');
      expect(value.date).toBe('2026-09-05');
    });

    it('builds one FormArray group per scanned item', () => {
      component.patchFromScan(receipt());
      expect(component.items.length).toBe(2);
      expect(component.items.at(0).getRawValue()).toEqual({
        name: 'Amul Gold Milk 1L',
        price: 34,
        qty: 2,
      });
    });

    it('replaces items on a re-scan instead of appending', () => {
      component.patchFromScan(receipt());
      component.patchFromScan(receipt({ items: [{ name: 'Tata Salt', price: 28, qty: 1 }] }));
      expect(component.items.length).toBe(1);
    });

    it('surfaces warnings and confidence for the user to check', () => {
      component.patchFromScan(receipt());
      expect(component.scanWarnings()).toEqual(['check the items']);
      expect(component.scanConfidence()).toBe(0.93);
    });
  });

  describe('line items', () => {
    it('totals price x qty without float drift', () => {
      component.patchFromScan(receipt());
      expect(component.itemsTotal()).toBe(333.5);
    });

    it('flags a mismatch between items and the amount, without correcting it', () => {
      component.patchFromScan(receipt());
      const mismatch = component.itemsMismatch();
      expect(mismatch.total).toBe(333.5);
      expect(component.form.controls.amount.value).toBe(379.58);
    });

    it('copies the items total into amount only when asked', () => {
      component.patchFromScan(receipt());
      component.useItemsTotal();
      expect(component.form.controls.amount.value).toBe(333.5);
      expect(component.itemsMismatch()).toBeNull();
    });

    it('adds and removes rows', () => {
      component.addItem();
      component.addItem();
      expect(component.items.length).toBe(2);
      component.removeItem(0);
      expect(component.items.length).toBe(1);
    });
  });

  describe('submit', () => {
    it('does not call the API while the form is invalid', () => {
      component.submit();
      expect(transactionService.create).not.toHaveBeenCalled();
      expect(component.form.controls.amount.touched).toBe(true);
    });

    it('sends a clean expense payload', () => {
      // Payment mode set explicitly: the default belongs to the defaults test,
      // this one is about the shape of what goes over the wire.
      component.form.patchValue({ amount: 250, category: 'FUEL', paymentMode: 'CASH' });
      component.submit();
      const payload = transactionService.create.mock.calls[0][0];
      expect(payload).toMatchObject({
        amount: 250,
        type: 'EXPENSE',
        category: 'FUEL',
        paymentMode: 'CASH',
      });
      // Blank optionals must be omitted — the API rejects unknown/empty keys.
      expect(payload).not.toHaveProperty('notes');
      expect(payload).not.toHaveProperty('merchantName');
      expect(payload).not.toHaveProperty('accountId');
    });

    it('marks a scanned entry with source AI_SCAN', () => {
      component.patchFromScan(receipt());
      component.submit();
      expect(transactionService.create.mock.calls[0][0].source).toBe('AI_SCAN');
    });

    it('omits source for a hand-typed entry', () => {
      component.form.controls.amount.setValue(99);
      component.submit();
      expect(transactionService.create.mock.calls[0][0]).not.toHaveProperty('source');
    });

    it('switches the category set when moving to income', () => {
      component.setType(TransactionType.INCOME);
      // GROCERIES is not a valid income category, so it must not survive.
      expect(component.form.controls.category.value).toBe('SALARY');
    });

    it('silently drops an untouched row so one stray tap cannot block saving', () => {
      component.form.controls.amount.setValue(100);
      component.addItem();
      component.addItem();
      component.items.at(1).patchValue({ name: 'Real item', price: 40, qty: 2 });
      component.submit();
      expect(transactionService.create).toHaveBeenCalled();
      expect(transactionService.create.mock.calls[0][0].items).toEqual([
        { name: 'Real item', price: 40, qty: 2 },
      ]);
    });

    it('still blocks on a PARTIALLY filled row, which is a real mistake', () => {
      component.form.controls.amount.setValue(100);
      component.addItem();
      component.items.at(0).patchValue({ name: 'Milk', price: null, qty: 1 });
      component.submit();
      expect(transactionService.create).not.toHaveBeenCalled();
      expect(component.items.length).toBe(1);
    });

    it('sends an ISO date string, not the raw input value', () => {
      component.form.patchValue({ amount: 10, date: '2026-03-03' });
      component.submit();
      const { date } = transactionService.create.mock.calls[0][0];
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(new Date(date).getDate()).toBe(3);
    });
  });
});

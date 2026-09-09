import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PaymentMode,
  TransactionType,
} from '../../core/models/enums';
import { ScannedReceipt } from '../../core/models/receipt.model';
import { LineItem, TransactionPayload } from '../../core/models/transaction.model';
import { ReceiptService } from '../../core/services/receipt.service';
import { ToastService } from '../../core/services/toast.service';
import { TransactionService } from '../../core/services/transaction.service';
import { isFutureDate, toDateInputValue, toIsoFromDateInput } from '../../core/utils/date.util';
import { multiplyMoney, roundMoney, sumMoney } from '../../core/utils/money.util';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { AppHeader } from '../../shared/components/app-header/app-header';
import { Icon } from '../../shared/components/icon/icon';

/** One row of an itemised bill. */
type LineItemGroup = FormGroup<{
  name: FormControl<string>;
  price: FormControl<number | null>;
  qty: FormControl<number>;
}>;

type ScanState =
  { phase: 'idle' } | { phase: 'uploading'; percent: number } | { phase: 'analysing' };

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-add-expense',
  imports: [ReactiveFormsModule, RouterLink, InrPipe, AppHeader, Icon],
  templateUrl: './add-expense.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddExpense implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly transactionService = inject(TransactionService);
  private readonly receiptService = inject(ReceiptService);
  private readonly toast = inject(ToastService);

  /** Bound from the /edit/:id route by withComponentInputBinding. */
  readonly id = input<string | undefined>();

  protected readonly TransactionType = TransactionType;
  protected readonly PaymentMode = PaymentMode;

  /* ---------------------------------------------------------------- */
  /* Form                                                              */
  /* ---------------------------------------------------------------- */

  protected readonly form = this.fb.group({
    type: this.fb.nonNullable.control<TransactionType>(TransactionType.EXPENSE),
    amount: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(1_000_000_000),
    ]),
    // Most spends here are UPI, so that is the default a quick entry should
    // already be on. Cash is one tap away for the exceptions.
    paymentMode: this.fb.nonNullable.control<PaymentMode>(PaymentMode.ONLINE_BANKING),
    category: this.fb.nonNullable.control('GROCERIES'),
    date: this.fb.nonNullable.control(toDateInputValue(), Validators.required),
    merchantName: this.fb.nonNullable.control(''),
    notes: this.fb.nonNullable.control(''),
    items: this.fb.array<LineItemGroup>([]),
  });

  protected get items(): FormArray<LineItemGroup> {
    return this.form.controls.items;
  }

  /* ---------------------------------------------------------------- */
  /* Derived view state                                                */
  /* ---------------------------------------------------------------- */

  // Reactive Forms are not signal-based, so each field the template reacts to
  // is bridged individually. Bridging per-control rather than the whole form
  // keeps recomputation narrow — typing in `notes` must not re-run the
  // line-item totals.
  private readonly typeValue = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  private readonly amountValue = toSignal(this.form.controls.amount.valueChanges, {
    initialValue: this.form.controls.amount.value,
  });
  private readonly dateValue = toSignal(this.form.controls.date.valueChanges, {
    initialValue: this.form.controls.date.value,
  });
  private readonly itemsValue = toSignal(this.items.valueChanges, {
    initialValue: this.items.value,
  });

  protected readonly type = computed(() => this.typeValue());
  protected readonly isIncome = computed(() => this.type() === TransactionType.INCOME);

  protected readonly categories = computed(() =>
    this.isIncome() ? INCOME_CATEGORIES : EXPENSE_CATEGORIES,
  );

  protected readonly itemsTotal = computed(() =>
    sumMoney(
      (this.itemsValue() ?? []).map((item) =>
        multiplyMoney(Number(item.price ?? 0), Number(item.qty ?? 1)),
      ),
    ),
  );

  /**
   * Difference between the line items and the amount being saved.
   *
   * Shown, never auto-corrected: a gap is usually legitimate (GST, delivery
   * fee, a discount), so silently overwriting the user's total would be wrong
   * more often than it would help. We surface it with a one-tap "use this".
   */
  protected readonly itemsMismatch = computed(() => {
    const total = this.itemsTotal();
    const amount = this.amountValue();
    if (!total || amount === null || amount === undefined) return null;
    const diff = roundMoney(total - amount);
    return Math.abs(diff) < 0.01 ? null : { total, diff };
  });

  protected readonly dateIsFuture = computed(() => isFutureDate(this.dateValue()));

  protected readonly scanState = signal<ScanState>({ phase: 'idle' });
  protected readonly isScanning = computed(() => this.scanState().phase !== 'idle');
  protected readonly scanWarnings = signal<string[]>([]);
  protected readonly scanConfidence = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly isEditMode = computed(() => !!this.id());

  private scanned = false;

  constructor() {
    // Income and expense have different category sets, so a category from one
    // must not survive a switch to the other.
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      const valid = type === TransactionType.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      if (!valid.some((c) => c.value === this.form.controls.category.value)) {
        this.form.controls.category.setValue(valid[0].value, { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    const editId = this.id();
    if (editId) {
      this.loadForEdit(editId);
    }
  }

  /* ---------------------------------------------------------------- */
  /* AI receipt scan                                                   */
  /* ---------------------------------------------------------------- */

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // Always clear the input: without this, picking the SAME photo twice in a
    // row fires no change event and the retry silently does nothing.
    input.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.error('Please choose a photo of the receipt.');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      // Caught here so a doomed 12MB upload never leaves the phone.
      this.toast.error(
        `That photo is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 10MB — ` +
          'try again at a lower resolution.',
      );
      return;
    }

    this.scan(file);
  }

  private scan(file: File): void {
    this.scanState.set({ phase: 'uploading', percent: 0 });
    this.scanWarnings.set([]);
    this.scanConfidence.set(null);

    this.receiptService.scan(file).subscribe({
      next: (progress) => {
        if (progress.phase === 'done') {
          this.scanState.set({ phase: 'idle' });
          this.patchFromScan(progress.receipt);
        } else {
          this.scanState.set(progress);
        }
      },
      error: () => {
        // The interceptor has already shown the reason.
        this.scanState.set({ phase: 'idle' });
      },
    });
  }

  /**
   * Hydrates the form from an AI scan. Everything is a suggestion the user
   * reviews in place before saving.
   */
  protected patchFromScan(receipt: ScannedReceipt): void {
    this.form.patchValue({
      type: TransactionType.EXPENSE,
      amount: receipt.totalAmount,
      paymentMode: receipt.paymentMode,
      category: receipt.category,
      date: toDateInputValue(receipt.date),
      merchantName: receipt.merchantName ?? '',
      notes: receipt.notes ?? '',
    });

    // Rebuild rather than merge: the scan is the authoritative view of this
    // bill, and merging would strand rows from a previous scan in the list.
    this.items.clear();
    for (const item of receipt.items) {
      this.items.push(this.createItemGroup(item));
    }

    this.scanned = true;
    this.scanWarnings.set(receipt.warnings);
    this.scanConfidence.set(receipt.confidence);
    this.form.markAsDirty();

    const itemNote = receipt.items.length ? ` and ${receipt.items.length} items` : '';
    this.toast.success(`Read ${receipt.merchantName ?? 'receipt'}${itemNote}. Please check it.`);
  }

  /* ---------------------------------------------------------------- */
  /* Line items (dynamic FormArray)                                    */
  /* ---------------------------------------------------------------- */

  protected createItemGroup(item?: Partial<LineItem>): LineItemGroup {
    return this.fb.group({
      name: this.fb.nonNullable.control(item?.name ?? '', [
        Validators.required,
        Validators.maxLength(200),
      ]),
      price: this.fb.control<number | null>(item?.price ?? null, [
        Validators.required,
        Validators.min(0),
      ]),
      qty: this.fb.nonNullable.control(item?.qty ?? 1, [
        Validators.required,
        Validators.min(0.001),
      ]),
    });
  }

  protected addItem(): void {
    this.items.push(this.createItemGroup());
  }

  protected removeItem(index: number): void {
    this.items.removeAt(index);
  }

  protected clearItems(): void {
    this.items.clear();
  }

  /** Copies the line-item total into the amount field. */
  protected useItemsTotal(): void {
    this.form.controls.amount.setValue(this.itemsTotal());
    this.form.controls.amount.markAsDirty();
  }

  protected lineTotal(group: LineItemGroup): number {
    return multiplyMoney(
      Number(group.controls.price.value ?? 0),
      Number(group.controls.qty.value ?? 1),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Field helpers used by the template                                */
  /* ---------------------------------------------------------------- */

  protected setType(type: TransactionType): void {
    this.form.controls.type.setValue(type);
  }

  protected setPaymentMode(mode: PaymentMode): void {
    this.form.controls.paymentMode.setValue(mode);
  }

  protected setCategory(category: string): void {
    this.form.controls.category.setValue(category);
  }

  protected showError(controlName: 'amount' | 'date'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  /* ---------------------------------------------------------------- */
  /* Load for edit                                                     */
  /* ---------------------------------------------------------------- */

  private loadForEdit(id: string): void {
    this.transactionService.get(id).subscribe({
      next: (tx) => {
        this.form.patchValue({
          type: tx.type,
          amount: tx.amount,
          paymentMode: tx.paymentMode,
          category: tx.category,
          date: toDateInputValue(tx.date),
          merchantName: tx.merchantName ?? '',
          notes: tx.notes ?? '',
        });

        this.items.clear();
        for (const item of tx.items ?? []) {
          this.items.push(this.createItemGroup(item));
        }

        // Loading is not a user edit; leaving it pristine keeps the Save
        // button honest about whether anything actually changed.
        this.form.markAsPristine();
      },
      error: () => this.router.navigate(['/transactions']),
    });
  }

  /* ---------------------------------------------------------------- */
  /* Submit                                                            */
  /* ---------------------------------------------------------------- */

  protected submit(addAnother = false): void {
    this.pruneEmptyItems();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.items.controls.forEach((group) => group.markAllAsTouched());
      this.focusFirstError();
      this.toast.error('Please fix the highlighted fields.');
      return;
    }

    const payload = this.buildPayload();
    this.saving.set(true);

    const editId = this.id();
    const request$ = editId
      ? this.transactionService.update(editId, payload)
      : this.transactionService.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(editId ? 'Transaction updated.' : 'Saved.');

        if (addAnother) {
          this.resetForNextEntry();
        } else {
          this.router.navigate([editId ? '/transactions' : '/']);
        }
      },
      error: () => {
        // Stay on the form with the user's input intact so they can retry.
        this.saving.set(false);
      },
    });
  }

  /**
   * Drops rows the user opened with "+ Add item" and never filled in.
   *
   * Without this, one accidental tap leaves a row that fails `required` and
   * blocks the save with an error pointing at an empty box. A row with ANY
   * content is left alone so it still gets validated properly.
   */
  private pruneEmptyItems(): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const { name, price } = this.items.at(i).getRawValue();
      if (!name?.trim() && (price === null || price === undefined)) {
        this.items.removeAt(i);
      }
    }
  }

  private buildPayload(): TransactionPayload {
    const raw = this.form.getRawValue();

    const items: LineItem[] = raw.items
      .filter((item) => item.name?.trim() && item.price !== null)
      .map((item) => ({
        name: item.name.trim(),
        price: roundMoney(Number(item.price)),
        qty: Number(item.qty) || 1,
      }));

    return {
      amount: roundMoney(Number(raw.amount)),
      type: raw.type,
      paymentMode: raw.paymentMode,
      category: raw.category,
      date: toIsoFromDateInput(raw.date),
      // Only send optional fields when they carry a value — the API rejects
      // unknown/blank keys under forbidNonWhitelisted.
      ...(items.length ? { items } : {}),
      ...(raw.notes.trim() ? { notes: raw.notes.trim() } : {}),
      ...(raw.merchantName.trim() ? { merchantName: raw.merchantName.trim() } : {}),
      ...(this.scanned && !this.isEditMode() ? { source: 'AI_SCAN' as const } : {}),
    };
  }

  /** Keeps type, date and payment mode so a run of entries is quick to log. */
  private resetForNextEntry(): void {
    const { type, date, paymentMode, category } = this.form.getRawValue();
    this.items.clear();
    this.form.reset({
      type,
      date,
      paymentMode,
      category,
      amount: null,
      merchantName: '',
      notes: '',
    });
    this.scanned = false;
    this.scanWarnings.set([]);
    this.scanConfidence.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private focusFirstError(): void {
    // Without this the first invalid field can be off-screen and the form
    // just appears not to submit.
    queueMicrotask(() => {
      const el = document.querySelector<HTMLElement>('[data-invalid="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { categoryMeta, DateRangePreset, PaymentMode, TransactionType } from '../../core/models/enums';
import { Paginated, Transaction } from '../../core/models/transaction.model';
import { ToastService } from '../../core/services/toast.service';
import { TransactionQuery, TransactionService } from '../../core/services/transaction.service';
import { EXPENSE_CATEGORIES } from '../../core/models/enums';
import { InrPipe } from '../../shared/pipes/inr.pipe';

interface DayGroup {
  date: string;
  label: string;
  spent: number;
  transactions: Transaction[];
}

const RANGES = [
  { value: DateRangePreset.TODAY, label: 'Today' },
  { value: DateRangePreset.YESTERDAY, label: 'Yesterday' },
  { value: DateRangePreset.THIS_WEEK, label: 'This week' },
  { value: DateRangePreset.THIS_MONTH, label: 'This month' },
  { value: DateRangePreset.LAST_MONTH, label: 'Last month' },
  { value: DateRangePreset.ALL, label: 'All time' },
  { value: DateRangePreset.CUSTOM, label: 'Custom' },
] as const;

@Component({
  selector: 'app-ledger',
  imports: [ReactiveFormsModule, RouterLink, InrPipe],
  templateUrl: './ledger.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ledger {
  private readonly fb = inject(FormBuilder);
  private readonly transactionService = inject(TransactionService);
  private readonly toast = inject(ToastService);

  protected readonly ranges = RANGES;
  protected readonly allCategories = EXPENSE_CATEGORIES;
  protected readonly PaymentMode = PaymentMode;
  protected readonly DateRangePreset = DateRangePreset;

  /** Filters are a form so the whole bar is one reactive value. */
  protected readonly filters = this.fb.nonNullable.group({
    range: this.fb.nonNullable.control<DateRangePreset>(DateRangePreset.THIS_MONTH),
    from: this.fb.nonNullable.control(''),
    to: this.fb.nonNullable.control(''),
    paymentMode: this.fb.nonNullable.control<PaymentMode | ''>(''),
    category: this.fb.nonNullable.control(''),
    search: this.fb.nonNullable.control(''),
  });

  protected readonly showFilters = signal(false);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly failed = signal(false);
  protected readonly deletingId = signal<string | null>(null);

  private readonly filterValue = toSignal(
    this.filters.valueChanges.pipe(startWith(this.filters.getRawValue())),
    { initialValue: this.filters.getRawValue() },
  );

  /**
   * Only the SEARCH text is debounced.
   *
   * Debouncing the whole filter form would put a 250ms lag on the first load
   * and on every range or category tap — controls whose value is final the
   * instant they are pressed, where waiting just feels broken. `startWith`
   * sits after `debounceTime` so the initial value is emitted synchronously
   * rather than 250ms late.
   */
  private readonly search$ = this.filters.controls.search.valueChanges.pipe(
    debounceTime(250),
    map((value) => value.trim()),
    distinctUntilChanged(),
    startWith(this.filters.controls.search.value.trim()),
  );

  /** Everything except search — applied immediately. */
  private readonly criteria$ = this.filters.valueChanges.pipe(
    map(() => {
      const { search: _search, ...rest } = this.filters.getRawValue();
      return rest;
    }),
    // Suppresses the echo when only the search box changed.
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    startWith((() => {
      const { search: _search, ...rest } = this.filters.getRawValue();
      return rest;
    })()),
  );

  private readonly result = toSignal(
    combineLatest([this.criteria$, this.search$, toObservable(this.page)]).pipe(
      switchMap(([criteria, search, page]) =>
        this.transactionService.list(this.toQuery({ ...criteria, search }, page)).pipe(
          catchError(() => {
            this.failed.set(true);
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null as Paginated<Transaction> | null },
  );

  protected readonly loading = computed(() => this.result() === null && !this.failed());
  protected readonly meta = computed(() => this.result()?.meta ?? null);
  protected readonly transactions = computed(() => this.result()?.data ?? []);

  protected readonly activeFilterCount = computed(() => {
    const f = this.filterValue();
    let count = 0;
    if (f.paymentMode) count++;
    if (f.category) count++;
    if (f.search?.trim()) count++;
    if (f.range !== DateRangePreset.THIS_MONTH) count++;
    return count;
  });

  protected readonly isCustomRange = computed(
    () => this.filterValue().range === DateRangePreset.CUSTOM,
  );

  /**
   * Groups rows under day headers.
   *
   * A flat list of 50 rows gives no sense of rhythm; a per-day subtotal is
   * what makes "I spent a lot on Saturday" visible without opening anything.
   * The API already sorts by date descending, so a single pass preserves it.
   */
  protected readonly groups = computed<DayGroup[]>(() => {
    const groups = new Map<string, DayGroup>();

    for (const tx of this.transactions()) {
      const date = new Date(tx.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      let group = groups.get(key);
      if (!group) {
        group = { date: key, label: this.dayLabel(date), spent: 0, transactions: [] };
        groups.set(key, group);
      }

      group.transactions.push(tx);
      // Income must not inflate a day's SPEND subtotal.
      if (tx.type === TransactionType.EXPENSE) {
        group.spent = Math.round((group.spent + tx.amount) * 100) / 100;
      }
    }

    return [...groups.values()];
  });

  protected toggleExpanded(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  protected setRange(range: DateRangePreset): void {
    this.filters.controls.range.setValue(range);
    this.page.set(1);
  }

  protected setPaymentMode(mode: PaymentMode | ''): void {
    this.filters.controls.paymentMode.setValue(mode);
    this.page.set(1);
  }

  protected resetFilters(): void {
    this.filters.reset({
      range: DateRangePreset.THIS_MONTH,
      from: '', to: '', paymentMode: '', category: '', search: '',
    });
    this.page.set(1);
  }

  protected nextPage(): void {
    if (this.meta()?.hasMore) {
      this.page.update((p) => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected prevPage(): void {
    if ((this.meta()?.page ?? 1) > 1) {
      this.page.update((p) => Math.max(1, p - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected remove(tx: Transaction): void {
    const confirmed = window.confirm(
      `Delete this ${tx.type.toLowerCase()} of ₹${tx.amount.toFixed(2)}?`,
    );
    if (!confirmed) return;

    this.deletingId.set(tx._id);
    this.transactionService.remove(tx._id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.toast.success('Deleted.');
        // Re-run the query so the list and day subtotals both reflect it.
        this.filters.updateValueAndValidity();
      },
      error: () => this.deletingId.set(null),
    });
  }

  protected meta_(tx: Transaction) {
    return categoryMeta(tx.category);
  }

  protected itemsTotal(tx: Transaction): number {
    return Math.round(
      (tx.items ?? []).reduce((sum, i) => sum + Math.round(i.price * 100) * i.qty, 0),
    ) / 100;
  }

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }

  private dayLabel(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';

    return target.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(target.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    });
  }

  private toQuery(filters: ReturnType<typeof this.filters.getRawValue>, page: number): TransactionQuery {
    const isCustom = filters.range === DateRangePreset.CUSTOM;
    return {
      range: filters.range,
      ...(isCustom && filters.from ? { from: filters.from } : {}),
      ...(isCustom && filters.to ? { to: filters.to } : {}),
      ...(filters.paymentMode ? { paymentMode: filters.paymentMode } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
      page,
      limit: 25,
    };
  }
}

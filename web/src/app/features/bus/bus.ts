import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, of, switchMap } from 'rxjs';
import { BusMonth, COMMON_BUS_FARES } from '../../core/models/bus.model';
import { BusService } from '../../core/services/bus.service';
import { ToastService } from '../../core/services/toast.service';
import { AppHeader } from '../../shared/components/app-header/app-header';
import { Icon } from '../../shared/components/icon/icon';
import { InrPipe } from '../../shared/pipes/inr.pipe';

/** One cell in the month calendar grid. `null` pads before the 1st day of the month. */
export interface BusDayCell {
  date: string;
  day: number;
  price: number | null;
  isToday: boolean;
  isFuture: boolean;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Local calendar day as YYYY-MM-DD. */
function dayKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5));
  const shifted = new Date(year, monthNumber - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-bus',
  imports: [AppHeader, Icon, InrPipe],
  templateUrl: './bus.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Bus {
  private readonly busService = inject(BusService);
  private readonly toast = inject(ToastService);

  protected readonly weekdays = WEEKDAYS;
  protected readonly commonFares = COMMON_BUS_FARES;

  protected readonly today = dayKey(new Date());
  private readonly currentMonth = this.today.slice(0, 7);

  protected readonly month = signal(this.currentMonth);
  protected readonly selectedDate = signal(this.today);
  protected readonly ticketPriceInput = signal('');
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);

  /** Bumped after every save/delete to refresh the month data. */
  private readonly reload = signal(0);

  private readonly result = toSignal(
    combineLatest([toObservable(this.month), toObservable(this.reload)]).pipe(
      switchMap(([month]) =>
        this.busService.month(month).pipe(
          catchError(() => {
            this.failed.set(true);
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null as BusMonth | null },
  );

  protected readonly loading = computed(() => this.result() === null && !this.failed());
  protected readonly summary = computed(() => this.result()?.summary ?? null);

  /** Map of date string -> price for instant O(1) lookup. */
  private readonly entriesByDate = computed(() => {
    const map = new Map<string, number>();
    for (const entry of this.result()?.entries ?? []) {
      map.set(entry.date, entry.price);
    }
    return map;
  });

  /** Ticket price recorded on the currently selected date, if any. */
  protected readonly selectedPrice = computed(() => {
    return this.entriesByDate().get(this.selectedDate()) ?? null;
  });

  /** Human-readable month label: "November 2026". */
  protected readonly monthLabel = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  });

  /** Calendar grid cells for the active month. */
  protected readonly cells = computed<(BusDayCell | null)[]>(() => {
    const [year, monthNumber] = this.month().split('-').map(Number);
    const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const map = this.entriesByDate();

    const cells: (BusDayCell | null)[] = [];

    // Leading padding for the days of week before the 1st
    for (let i = 0; i < firstWeekday; i++) {
      cells.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${this.month()}-${String(d).padStart(2, '0')}`;
      cells.push({
        date,
        day: d,
        price: map.get(date) ?? null,
        isToday: date === this.today,
        isFuture: date > this.today,
      });
    }

    return cells;
  });

  protected readonly canGoNext = computed(() => this.month() < this.currentMonth);

  protected readonly selectionIsVisible = computed(() =>
    this.selectedDate().startsWith(this.month()),
  );

  protected readonly selectedLabel = computed(() => {
    const selected = this.selectedDate();
    if (selected === this.today) return 'Today';
    const [y, m, d] = selected.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  });

  /* ---------------------------------------------------------------- */
  /* Actions                                                           */
  /* ---------------------------------------------------------------- */

  protected onDateInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value && value <= this.today) {
      this.selectedDate.set(value);
      this.syncInputWithSelected();
    }
  }

  protected selectDay(date: string): void {
    this.selectedDate.set(date);
    this.syncInputWithSelected();
  }

  private syncInputWithSelected(): void {
    const existing = this.entriesByDate().get(this.selectedDate());
    if (existing !== undefined && existing !== null) {
      this.ticketPriceInput.set(String(existing));
    } else {
      this.ticketPriceInput.set('');
    }
  }

  protected onPriceChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.ticketPriceInput.set(val);
  }

  protected setQuickFare(fare: number): void {
    this.ticketPriceInput.set(String(fare));
    this.record(fare);
  }

  protected saveManualTicket(): void {
    const val = parseFloat(this.ticketPriceInput().trim());
    if (isNaN(val) || val <= 0) {
      this.toast.error('Please enter a valid ticket price.');
      return;
    }
    this.record(val);
  }

  protected record(price: number): void {
    const date = this.selectedDate();
    if (date > this.today) {
      this.toast.error('Cannot log a ticket for a future date.');
      return;
    }

    this.saving.set(true);
    this.busService.save(date, price).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(`Saved ₹${price} bus ticket on ${this.selectedLabel()}.`);
        this.ticketPriceInput.set(String(price));
        this.reload.update((n) => n + 1);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected removeSelected(): void {
    const date = this.selectedDate();
    this.saving.set(true);
    this.busService.remove(date).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(`Removed bus ticket for ${this.selectedLabel()}.`);
        this.ticketPriceInput.set('');
        this.reload.update((n) => n + 1);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected prevMonth(): void {
    this.month.update((m) => shiftMonth(m, -1));
  }

  protected nextMonth(): void {
    if (this.canGoNext()) {
      this.month.update((m) => shiftMonth(m, 1));
    }
  }

  protected showSelectedMonth(): void {
    this.month.set(this.selectedDate().slice(0, 7));
  }

  protected cellClass(cell: BusDayCell): string {
    const isSelected = this.selectedDate() === cell.date;

    if (isSelected) {
      return 'border-accent bg-accent-soft text-accent-fg font-bold shadow-xs';
    }

    if (cell.price !== null) {
      return 'border-spend-line bg-card text-fg font-medium active:bg-hover';
    }

    if (cell.isToday) {
      return 'border-line-strong bg-sunken text-fg font-semibold';
    }

    return 'border-transparent text-fg-subtle active:bg-hover';
  }
}

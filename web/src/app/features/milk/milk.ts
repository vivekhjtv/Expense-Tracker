import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, of, switchMap } from 'rxjs';
import { MILK_QUANTITIES, MilkMonth } from '../../core/models/milk.model';
import { MilkService } from '../../core/services/milk.service';
import { ToastService } from '../../core/services/toast.service';
import { AppHeader } from '../../shared/components/app-header/app-header';
import { Icon } from '../../shared/components/icon/icon';

/** One square in the month grid. `null` pads the week before the 1st. */
export interface DayCell {
  date: string;
  day: number;
  quantity: number | null;
  isToday: boolean;
  isFuture: boolean;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Local calendar day as YYYY-MM-DD — the same shape the API stores. */
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

/**
 * Daily milk log: record a day's litres, and see the whole month at once.
 *
 * Entry and history are one screen on purpose. The question being answered is
 * "did I already log today, and what has the month looked like" — and a
 * calendar answers both in a glance, which a list of dated rows does not: a
 * missed day is a visible hole in the grid rather than an absence you have to
 * notice.
 */
@Component({
  selector: 'app-milk',
  imports: [AppHeader, Icon],
  templateUrl: './milk.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Milk {
  private readonly milkService = inject(MilkService);
  private readonly toast = inject(ToastService);

  protected readonly quantities = MILK_QUANTITIES;
  protected readonly weekdays = WEEKDAYS;

  /** Today, captured once: a signal that changes at midnight would be worse. */
  protected readonly today = dayKey(new Date());
  private readonly currentMonth = this.today.slice(0, 7);

  protected readonly month = signal(this.currentMonth);
  protected readonly selectedDate = signal(this.today);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);

  /** Bumped after every write, to re-fetch the month the calendar is showing. */
  private readonly reload = signal(0);

  private readonly result = toSignal(
    combineLatest([toObservable(this.month), toObservable(this.reload)]).pipe(
      switchMap(([month]) =>
        this.milkService.month(month).pipe(
          catchError(() => {
            this.failed.set(true);
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null as MilkMonth | null },
  );

  protected readonly loading = computed(() => this.result() === null && !this.failed());
  protected readonly summary = computed(() => this.result()?.summary ?? null);

  /** Day -> litres, so a cell is a lookup rather than a scan of the month. */
  private readonly byDate = computed(() => {
    const map = new Map<string, number>();
    for (const entry of this.result()?.entries ?? []) {
      map.set(entry.date, entry.quantity);
    }
    return map;
  });

  protected readonly monthLabel = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  });

  /** There is nothing to show past the current month, so do not go there. */
  protected readonly canGoNext = computed(() => this.month() < this.currentMonth);

  protected readonly isCurrentMonth = computed(() => this.month() === this.currentMonth);

  protected readonly cells = computed<(DayCell | null)[]>(() => {
    const month = this.month();
    const [year, monthNumber] = month.split('-').map(Number);
    const byDate = this.byDate();

    const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
    // Day 0 of the next month is the last day of this one.
    const daysInMonth = new Date(year, monthNumber, 0).getDate();

    const cells: (DayCell | null)[] = Array.from({ length: firstWeekday }, () => null);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      cells.push({
        date,
        day,
        quantity: byDate.get(date) ?? null,
        isToday: date === this.today,
        isFuture: date > this.today,
      });
    }

    return cells;
  });

  /** What the selected day currently holds, if anything. */
  protected readonly selectedQuantity = computed(
    () => this.byDate().get(this.selectedDate()) ?? null,
  );

  /**
   * The selected day only lives in the month on screen while the two agree —
   * so its entry is unknown whenever the calendar has been paged elsewhere.
   */
  protected readonly selectionIsVisible = computed(
    () => this.selectedDate().slice(0, 7) === this.month(),
  );

  protected readonly selectedLabel = computed(() => {
    const [year, month, day] = this.selectedDate().split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  });

  /**
   * Tone for one day square, as one string.
   *
   * Built here rather than as a stack of `[class.x]` bindings so the rules
   * stay readable: a recorded day is washed in accent, the selected day wears
   * a ring, today is bold.
   */
  protected cellClass(cell: DayCell): string {
    const tone =
      cell.quantity !== null
        ? 'border-accent-line bg-accent-soft text-accent-fg'
        : 'border-transparent bg-sunken text-fg-subtle';
    const selected = this.selectedDate() === cell.date ? 'ring-2 ring-accent' : '';
    const today = cell.isToday ? 'font-bold' : '';

    return `${tone} ${selected} ${today}`;
  }

  /* ---------------------------------------------------------------- */
  /* Actions                                                           */
  /* ---------------------------------------------------------------- */

  protected onDateInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return;
    this.selectDay(value);
  }

  protected selectDay(date: string): void {
    if (date > this.today) return;
    this.selectedDate.set(date);
    // Picking a day outside the month on screen moves the calendar to it,
    // rather than selecting something the user cannot see.
    const month = date.slice(0, 7);
    if (month !== this.month()) {
      this.month.set(month);
    }
  }

  /**
   * Records the tapped quantity straight away.
   *
   * No separate Save: this is a once-a-day, one-tap entry, and the write is an
   * upsert — tapping the wrong chip is corrected by tapping the right one,
   * which is faster than a confirm step would be.
   */
  protected record(quantity: number): void {
    if (this.saving()) return;

    const date = this.selectedDate();
    this.saving.set(true);

    this.milkService.save(date, quantity).subscribe({
      next: () => {
        this.saving.set(false);
        this.reload.update((n) => n + 1);
        this.toast.success(`${quantity} L on ${this.selectedLabel()}.`);
      },
      error: () => this.saving.set(false),
    });
  }

  protected removeSelected(): void {
    const date = this.selectedDate();
    if (this.selectedQuantity() === null || this.saving()) return;

    this.saving.set(true);
    this.milkService.remove(date).subscribe({
      next: () => {
        this.saving.set(false);
        this.reload.update((n) => n + 1);
        this.toast.success('Entry removed.');
      },
      error: () => this.saving.set(false),
    });
  }

  /** Brings the calendar back to the month holding the selected day. */
  protected showSelectedMonth(): void {
    this.month.set(this.selectedDate().slice(0, 7));
  }

  protected prevMonth(): void {
    this.month.update((month) => shiftMonth(month, -1));
  }

  protected nextMonth(): void {
    if (!this.canGoNext()) return;
    this.month.update((month) => shiftMonth(month, 1));
  }

  protected goToThisMonth(): void {
    this.month.set(this.currentMonth);
    this.selectedDate.set(this.today);
  }
}

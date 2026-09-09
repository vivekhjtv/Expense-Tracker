import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DashboardData } from '../../core/models/analytics.model';
import { categoryMeta, DateRangePreset } from '../../core/models/enums';
import { AnalyticsService } from '../../core/services/analytics.service';
import { CategoryDonut } from '../../shared/components/category-donut/category-donut';
import { SplitBar } from '../../shared/components/split-bar/split-bar';
import { TrendBars } from '../../shared/components/trend-bars/trend-bars';
import { InrPipe } from '../../shared/pipes/inr.pipe';

const RANGES = [
  { value: DateRangePreset.THIS_WEEK, label: 'Week' },
  { value: DateRangePreset.THIS_MONTH, label: 'Month' },
  { value: DateRangePreset.LAST_MONTH, label: 'Last month' },
  { value: DateRangePreset.THIS_YEAR, label: 'Year' },
] as const;

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, InrPipe, TrendBars, CategoryDonut, SplitBar],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly analyticsService = inject(AnalyticsService);

  protected readonly ranges = RANGES;
  protected readonly range = signal<DateRangePreset>(DateRangePreset.THIS_MONTH);
  protected readonly failed = signal(false);

  private readonly data = toSignal(
    toObservable(this.range).pipe(
      // switchMap, not mergeMap: tapping through range chips quickly must
      // cancel the previous request, or a slow earlier response can land last
      // and repaint the dashboard with the wrong period.
      switchMap((range) =>
        this.analyticsService.dashboard({ range }).pipe(
          catchError(() => {
            this.failed.set(true);
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null as DashboardData | null },
  );

  protected readonly summary = computed(() => this.data()?.summary ?? null);
  protected readonly dailyTrend = computed(() => this.data()?.dailyTrend ?? []);
  protected readonly categories = computed(() => this.data()?.categories ?? []);
  protected readonly paymentModes = computed(() => this.data()?.paymentModes ?? []);
  protected readonly loading = computed(() => this.data() === null && !this.failed());

  protected readonly hasSpend = computed(() => (this.summary()?.totalSpend ?? 0) > 0);

  protected readonly rangeLabel = computed(
    () => RANGES.find((r) => r.value === this.range())?.label ?? 'Month',
  );

  protected readonly topCategoryLabel = computed(() => {
    const top = this.summary()?.topCategory;
    return top ? categoryMeta(top.category) : null;
  });

  protected setRange(range: DateRangePreset): void {
    this.range.set(range);
  }
}

import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DailyPoint } from '../../../core/models/analytics.model';
import { CHART_GRID, CHART_PRIMARY } from '../../chart-palette';
import { InrPipe } from '../../pipes/inr.pipe';

interface Bar {
  point: DailyPoint;
  x: number;
  y: number;
  width: number;
  height: number;
  day: number;
}

const VIEW_W = 340;
const PLOT_H = 110;
const AXIS_H = 22;
const PAD_X = 4;

/**
 * Daily spending trend.
 *
 * Bars, not a line: daily spend is a series of discrete events, and a line
 * would draw a slope between Tuesday and Thursday implying money moved on
 * Wednesday when nothing happened. Zero days are genuinely zero here.
 *
 * One colour for every bar — a darker-where-bigger ramp would double-encode
 * height as hue and spend the only free channel restating what length says.
 */
@Component({
  selector: 'app-trend-bars',
  imports: [InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="m-0">
      <figcaption class="sr-only">Daily spending for the selected period</figcaption>

      <!-- Tapped value sits above the plot in a fixed slot, so revealing it
           never reflows the chart underneath the user's finger. -->
      <p class="mb-1 h-5 text-xs font-semibold text-ink-700">
        @if (selected(); as bar) {
          {{ bar.point.total | inr }}
          <span class="font-normal text-ink-400">· {{ label(bar.point.date) }}</span>
        } @else if (peak(); as top) {
          <span class="font-normal text-ink-400">Highest: </span>{{ top.total | inr }}
          <span class="font-normal text-ink-400">on {{ label(top.date) }}</span>
        }
      </p>

      <svg
        [attr.viewBox]="'0 0 ' + VIEW_W + ' ' + (PLOT_H + AXIS_H)"
        class="w-full"
        role="img"
        [attr.aria-label]="ariaLabel()"
        preserveAspectRatio="none"
      >
        <!-- Hairline grid, solid and one step off the surface. -->
        @for (line of gridLines(); track line.value) {
          <line
            [attr.x1]="0" [attr.x2]="VIEW_W" [attr.y1]="line.y" [attr.y2]="line.y"
            [attr.stroke]="grid" stroke-width="1" vector-effect="non-scaling-stroke"
          />
        }

        @for (bar of bars(); track bar.point.date) {
          <!-- Invisible full-height hit area: the bar itself can be 2px tall,
               far below a usable touch target. -->
          <rect
            [attr.x]="bar.x - 1" [attr.y]="0"
            [attr.width]="bar.width + 2" [attr.height]="PLOT_H"
            fill="transparent"
            class="cursor-pointer"
            (click)="toggle(bar)"
          />
          @if (bar.height > 0) {
            <rect
              [attr.x]="bar.x" [attr.y]="bar.y"
              [attr.width]="bar.width" [attr.height]="bar.height"
              [attr.fill]="primary"
              [attr.fill-opacity]="isDimmed(bar) ? 0.28 : 1"
              rx="2"
              class="pointer-events-none transition-opacity"
            />
          }
        }

        <!-- Baseline sits above the axis band so labels are never clipped. -->
        <line
          [attr.x1]="0" [attr.x2]="VIEW_W" [attr.y1]="PLOT_H" [attr.y2]="PLOT_H"
          [attr.stroke]="grid" stroke-width="1" vector-effect="non-scaling-stroke"
        />

        <!-- Selective labels: first, last and the peak. A number on every day
             would be unreadable at this width. -->
        @for (tick of ticks(); track tick.x) {
          <text
            [attr.x]="tick.x" [attr.y]="PLOT_H + 15"
            text-anchor="middle" font-size="10" fill="#94a3b8"
          >{{ tick.label }}</text>
        }
      </svg>
    </figure>
  `,
})
export class TrendBars {
  readonly points = input.required<DailyPoint[]>();

  protected readonly VIEW_W = VIEW_W;
  protected readonly PLOT_H = PLOT_H;
  protected readonly AXIS_H = AXIS_H;
  protected readonly primary = CHART_PRIMARY;
  protected readonly grid = CHART_GRID;

  private readonly selectedDate = signal<string | null>(null);

  protected readonly max = computed(() =>
    Math.max(1, ...this.points().map((p) => p.total)),
  );

  protected readonly bars = computed<Bar[]>(() => {
    const points = this.points();
    if (!points.length) return [];

    const slot = (VIEW_W - PAD_X * 2) / points.length;
    // Cap the bar and leave the rest as air; a bar filling its slot reads as
    // a solid block rather than a chart.
    const width = Math.min(slot * 0.62, 24);
    const max = this.max();

    return points.map((point, i) => {
      const height = point.total > 0 ? Math.max(2, (point.total / max) * (PLOT_H - 8)) : 0;
      return {
        point,
        x: PAD_X + i * slot + (slot - width) / 2,
        y: PLOT_H - height,
        width,
        height,
        day: Number(point.date.slice(8, 10)),
      };
    });
  });

  protected readonly gridLines = computed(() =>
    [0.5, 1].map((fraction) => ({
      value: fraction,
      y: PLOT_H - fraction * (PLOT_H - 8),
    })),
  );

  protected readonly peak = computed(() => {
    const points = this.points().filter((p) => p.total > 0);
    if (!points.length) return null;
    return points.reduce((best, p) => (p.total > best.total ? p : best));
  });

  protected readonly selected = computed(() => {
    const date = this.selectedDate();
    return date ? (this.bars().find((b) => b.point.date === date) ?? null) : null;
  });

  protected readonly ticks = computed(() => {
    const bars = this.bars();
    if (bars.length < 2) return [];
    const peakDate = this.peak()?.date;
    const chosen = new Set([bars[0], bars[bars.length - 1]]);
    const peakBar = bars.find((b) => b.point.date === peakDate);
    // Skip the peak label if it would collide with an endpoint label.
    if (peakBar && Math.abs(peakBar.x - bars[0].x) > 40 &&
        Math.abs(peakBar.x - bars[bars.length - 1].x) > 40) {
      chosen.add(peakBar);
    }
    return [...chosen]
      .sort((a, b) => a.x - b.x)
      .map((b) => ({ x: b.x + b.width / 2, label: String(b.day) }));
  });

  protected readonly ariaLabel = computed(() => {
    const total = this.points().reduce((sum, p) => sum + p.total, 0);
    return `Daily spending bar chart across ${this.points().length} days, totalling ${total.toFixed(0)} rupees`;
  });

  protected isDimmed(bar: Bar): boolean {
    const selected = this.selectedDate();
    return selected !== null && selected !== bar.point.date;
  }

  protected toggle(bar: Bar): void {
    this.selectedDate.update((current) =>
      current === bar.point.date ? null : bar.point.date,
    );
  }

  protected label(date: string): string {
    return new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }
}

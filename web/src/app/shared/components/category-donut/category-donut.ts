import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CategorySlice } from '../../../core/models/analytics.model';
import { categoryMeta } from '../../../core/models/enums';
import { CHART_EMPTY, CHART_OTHER, CHART_SERIES } from '../../chart-palette';
import { InrPipe } from '../../pipes/inr.pipe';

interface Segment {
  slice: CategorySlice;
  color: string;
  label: string;
  icon: string;
  dash: number;
  gap: number;
  offset: number;
}

const R = 52;
const STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * R;
const GAP = 3;

/**
 * Category breakdown.
 *
 * Capped at five named slices plus "Other": a donut only works for
 * part-to-whole at a glance, and past six segments adjacent arcs blur into
 * each other. The legend below carries every value — which is also the
 * required relief for the three palette slots that sit under 3:1 contrast on
 * white, so identity is never colour alone.
 *
 * Trade-off worth knowing: slots are assigned by rank, so a category can take
 * a different hue when the date range changes. A stable category→hue map is
 * impossible with 17 categories and only six validated slots, so identity is
 * carried by the always-visible legend labels instead of by hue memory.
 */
@Component({
  selector: 'app-category-donut',
  imports: [InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="m-0">
      <figcaption class="sr-only">Spending by category</figcaption>

      <div class="flex items-center gap-4">
        <svg
          viewBox="0 0 130 130"
          class="size-32 shrink-0 -rotate-90"
          role="img"
          [attr.aria-label]="ariaLabel()"
        >
          @for (segment of segments(); track segment.slice.category) {
            <circle
              cx="65"
              cy="65"
              [attr.r]="R"
              fill="none"
              [style.stroke]="segment.color"
              [attr.stroke-width]="STROKE"
              [attr.stroke-dasharray]="segment.dash + ' ' + segment.gap"
              [attr.stroke-dashoffset]="segment.offset"
            />
          }
          @if (!segments().length) {
            <circle
              cx="65"
              cy="65"
              [attr.r]="R"
              fill="none"
              [style.stroke]="empty"
              [attr.stroke-width]="STROKE"
            />
          }
        </svg>

        <!-- Total in the hole: the number the ring is a breakdown of. -->
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
            Total spend
          </p>
          <p class="text-2xl font-bold tracking-tight text-fg">{{ total() | inr: false }}</p>
          <p class="mt-0.5 text-xs text-fg-muted">
            across {{ slices().length }} categor{{ slices().length === 1 ? 'y' : 'ies' }}
          </p>
        </div>
      </div>

      <!-- Legend doubles as the table view: name, amount and share for every
           segment, so nothing depends on distinguishing two arcs by hue. -->
      <ul class="mt-4 space-y-2">
        @for (segment of segments(); track segment.slice.category) {
          <li class="flex items-center gap-2.5">
            <span
              class="size-2.5 shrink-0 rounded-full"
              [style.background-color]="segment.color"
              aria-hidden="true"
            ></span>
            <span class="min-w-0 flex-1 truncate text-sm text-fg">
              <span class="mr-1" aria-hidden="true">{{ segment.icon }}</span
              >{{ segment.label }}
            </span>
            <span class="shrink-0 text-sm font-semibold text-fg">
              {{ segment.slice.total | inr: false }}
            </span>
            <span class="w-11 shrink-0 text-right text-xs tabular-nums text-fg-subtle">
              {{ segment.slice.sharePct.toFixed(0) }}%
            </span>
          </li>
        }
      </ul>
    </figure>
  `,
})
export class CategoryDonut {
  readonly slices = input.required<CategorySlice[]>();

  protected readonly R = R;
  protected readonly empty = CHART_EMPTY;
  protected readonly STROKE = STROKE;

  protected readonly total = computed(
    () => Math.round(this.slices().reduce((sum, s) => sum + s.total, 0) * 100) / 100,
  );

  protected readonly segments = computed<Segment[]>(() => {
    const slices = this.slices().filter((s) => s.total > 0);
    if (!slices.length) return [];

    const named = slices.slice(0, 5);
    const tail = slices.slice(5);

    const grouped: CategorySlice[] = [...named];
    if (tail.length) {
      grouped.push({
        category: 'OTHER_GROUPED',
        total: Math.round(tail.reduce((sum, s) => sum + s.total, 0) * 100) / 100,
        count: tail.reduce((sum, s) => sum + s.count, 0),
        sharePct: Math.round(tail.reduce((sum, s) => sum + s.sharePct, 0) * 10) / 10,
      });
    }

    const total = grouped.reduce((sum, s) => sum + s.total, 0) || 1;
    let consumed = 0;

    return grouped.map((slice, index) => {
      const length = (slice.total / total) * CIRCUMFERENCE;
      // The 2px surface gap doing the separating — never a stroke drawn
      // around a segment.
      const dash = Math.max(0, length - GAP);
      const offset = -consumed;
      consumed += length;

      const isOther = slice.category === 'OTHER_GROUPED';
      const meta = categoryMeta(slice.category);

      return {
        slice,
        color: isOther ? CHART_OTHER : CHART_SERIES[index],
        label: isOther ? `Other (${tail.length})` : meta.label,
        icon: isOther ? '•' : meta.icon,
        dash,
        gap: CIRCUMFERENCE - dash,
        offset,
      };
    });
  });

  protected readonly ariaLabel = computed(
    () =>
      this.segments()
        .map((s) => `${s.label} ${s.slice.sharePct.toFixed(0)} percent`)
        .join(', ') || 'No spending recorded',
  );
}

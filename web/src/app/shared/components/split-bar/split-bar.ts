import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PaymentModeSlice } from '../../../core/models/analytics.model';
import { PAYMENT_COLORS } from '../../chart-palette';
import { InrPipe } from '../../pipes/inr.pipe';

/**
 * Cash vs online split.
 *
 * A single stacked bar rather than a donut: a two-slice pie is the classic
 * weak form — the reader has to compare two arcs to judge a ratio a single
 * bar shows directly, and it costs three times the vertical space on a phone.
 * Both segments are direct-labelled, so the numbers are read, not estimated.
 */
@Component({
  selector: 'app-split-bar',
  imports: [InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="m-0">
      <figcaption class="sr-only">Spending split between cash and online payments</figcaption>

      @if (total() > 0) {
        <!-- 2px surface gap separates the fills; no border around either. -->
        <div class="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
          @for (part of parts(); track part.mode) {
            @if (part.pct > 0) {
              <div
                class="h-full first:rounded-l-full last:rounded-r-full"
                [style.width.%]="part.pct"
                [style.background-color]="part.color"
                [attr.aria-label]="part.label + ' ' + part.pct.toFixed(0) + ' percent'"
              ></div>
            }
          }
        </div>

        <div class="mt-3 grid grid-cols-2 gap-3">
          @for (part of parts(); track part.mode) {
            <div>
              <div class="flex items-center gap-1.5">
                <span
                  class="size-2.5 shrink-0 rounded-full"
                  [style.background-color]="part.color"
                  aria-hidden="true"
                ></span>
                <span class="text-xs font-medium text-fg-muted">{{ part.label }}</span>
              </div>
              <p class="mt-0.5 text-lg font-bold tracking-tight text-fg">
                {{ part.slice.total | inr: false }}
              </p>
              <p class="text-[11px] text-fg-subtle">
                {{ part.pct.toFixed(0) }}% · {{ part.slice.count }} txn{{
                  part.slice.count === 1 ? '' : 's'
                }}
              </p>
            </div>
          }
        </div>
      } @else {
        <p class="py-4 text-center text-sm text-fg-subtle">No spending in this period.</p>
      }
    </figure>
  `,
})
export class SplitBar {
  readonly slices = input.required<PaymentModeSlice[]>();

  protected readonly total = computed(() => this.slices().reduce((sum, s) => sum + s.total, 0));

  protected readonly parts = computed(() => {
    const total = this.total();
    const order = ['CASH', 'ONLINE_BANKING'] as const;

    return order.map((mode) => {
      const slice =
        this.slices().find((s) => s.paymentMode === mode) ??
        ({ paymentMode: mode, total: 0, count: 0, sharePct: 0 } as PaymentModeSlice);

      return {
        mode,
        slice,
        color: PAYMENT_COLORS[mode],
        label: mode === 'CASH' ? 'Cash' : 'UPI / Card',
        pct: total > 0 ? (slice.total / total) * 100 : 0,
      };
    });
  });
}

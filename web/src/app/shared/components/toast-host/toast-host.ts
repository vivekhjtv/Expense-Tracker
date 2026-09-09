import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { Icon, IconName } from '../icon/icon';

/**
 * Toasts anchor to the TOP of the screen, not the bottom: the bottom is
 * occupied by the nav bar and the sticky save button, and a toast there would
 * cover the control the user just pressed.
 *
 * Each kind carries an icon as well as a colour, so the difference between
 * "saved" and "failed" survives colour-vision deficiency and a glance.
 */
@Component({
  selector: 'app-toast-host',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-3"
      style="padding-top: max(0.75rem, env(safe-area-inset-top))"
      role="status"
      aria-live="polite"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <button
          type="button"
          (click)="toastService.dismiss(toast.id)"
          class="pointer-events-auto flex w-full max-w-md animate-[drop_260ms_var(--ease-out-soft)]
                 items-center gap-2.5 rounded-2xl border px-4 py-3 text-left text-sm font-medium
                 shadow-lg backdrop-blur-sm"
          [class]="styles[toast.kind]"
        >
          <app-icon [name]="icons[toast.kind]" [size]="18" />
          <span class="min-w-0 flex-1">{{ toast.message }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    @keyframes drop {
      from {
        opacity: 0;
        transform: translateY(-12px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class ToastHost {
  protected readonly toastService = inject(ToastService);

  /* Soft-tinted rather than solid: a full-bleed saturated bar at the top of a
     dark screen is the single harshest thing an app can flash at you. */
  protected readonly styles: Record<string, string> = {
    success: 'bg-earn-soft border-earn-line text-earn-fg',
    error: 'bg-spend-soft border-spend-line text-spend-fg',
    info: 'bg-card border-line text-fg',
  };

  protected readonly icons: Record<string, IconName> = {
    success: 'check',
    error: 'alert',
    info: 'sparkle',
  };
}

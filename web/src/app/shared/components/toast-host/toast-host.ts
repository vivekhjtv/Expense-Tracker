import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Toasts anchor to the TOP of the screen, not the bottom: the bottom is
 * occupied by the nav bar and the sticky save button, and a toast there would
 * cover the control the user just pressed.
 */
@Component({
  selector: 'app-toast-host',
  imports: [],
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
          class="pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-left text-sm
                 font-medium shadow-lg ring-1 transition"
          [class]="styles[toast.kind]"
        >
          <span class="mr-2" aria-hidden="true">{{ icons[toast.kind] }}</span>{{ toast.message }}
        </button>
      }
    </div>
  `,
})
export class ToastHost {
  protected readonly toastService = inject(ToastService);

  protected readonly styles: Record<string, string> = {
    success: 'bg-earn-600 text-white ring-earn-700',
    error: 'bg-spend-600 text-white ring-spend-700',
    info: 'bg-ink-800 text-white ring-ink-900',
  };

  protected readonly icons: Record<string, string> = {
    success: '✓',
    error: '!',
    info: 'i',
  };
}

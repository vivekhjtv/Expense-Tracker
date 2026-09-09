import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="sticky top-0 z-30 border-b border-ink-200 bg-white/95 px-4 py-3 backdrop-blur-sm"
      style="padding-top: max(0.75rem, env(safe-area-inset-top))"
    >
      <h1 class="text-base font-semibold text-ink-900">More</h1>
    </header>

    <div class="space-y-3 p-3">
      @if (auth.user(); as user) {
        <section class="card flex items-center gap-3 p-4">
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100
                   text-base font-bold text-brand-700"
            aria-hidden="true"
          >{{ user.name.charAt(0).toUpperCase() }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-ink-900">{{ user.name }}</p>
            <p class="truncate text-[11px] text-ink-500">{{ user.email }}</p>
          </div>
        </section>
      }

      <nav class="card divide-y divide-ink-100 overflow-hidden">
        @for (link of links; track link.path) {
          <a [routerLink]="link.path" class="tap flex items-center gap-3 p-4 active:bg-ink-50">
            <span class="text-lg" aria-hidden="true">{{ link.icon }}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-ink-800">{{ link.label }}</span>
              <span class="block text-[11px] text-ink-400">{{ link.hint }}</span>
            </span>
            <span class="text-ink-300" aria-hidden="true">&#8250;</span>
          </a>
        }
      </nav>

      <section class="card p-4">
        <h2 class="mb-2 text-sm font-semibold text-ink-900">How this works</h2>
        <ul class="space-y-2 text-[11px] leading-relaxed text-ink-500">
          <li>
            <strong class="text-ink-700">No accounts, no balances.</strong> This is a spending
            log — record what you spent and how you paid. Nothing can ever refuse an entry.
          </li>
          <li>
            <strong class="text-ink-700">Receipts are never stored.</strong> The photo goes to
            Gemini, the numbers come back, and the image is discarded. Only what you approve is
            saved.
          </li>
          <li>
            <strong class="text-ink-700">Cash vs online</strong> is tracked on every entry, so
            the dashboard can show where your spending actually goes.
          </li>
        </ul>
      </section>

      <button
        type="button"
        (click)="signOut()"
        class="tap flex w-full items-center justify-center rounded-xl bg-white py-3.5
               text-sm font-semibold text-spend-600 ring-1 ring-ink-200 active:bg-spend-50"
      >
        Sign out
      </button>
    </div>
  `,
})
export class Settings {
  protected readonly auth = inject(AuthService);

  protected signOut(): void {
    this.auth.logout();
  }

  protected readonly links = [
    { path: '/add', label: 'Add a spend', icon: '➕', hint: 'Type it in or scan a receipt' },
    { path: '/ledger', label: 'Full ledger', icon: '🧾', hint: 'Search and filter everything' },
    { path: '/', label: 'Dashboard', icon: '📊', hint: 'Charts and totals' },
  ];
}

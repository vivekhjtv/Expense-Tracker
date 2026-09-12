import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppHeader } from '../../shared/components/app-header/app-header';
import { Icon, IconName } from '../../shared/components/icon/icon';
import { ThemeChoice } from '../../shared/components/theme/theme-choice';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, AppHeader, Icon, ThemeChoice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- No quick toggle in this header: the full three-way control is right
         there in the page, and two theme switches on one screen is one too
         many. -->
    <app-header title="More" [showThemeToggle]="false" />

    <div class="space-y-3 p-3">
      @if (auth.user(); as user) {
        <section class="card flex items-center gap-3.5 p-4">
          <span
            class="avatar flex size-12 shrink-0 items-center justify-center rounded-full text-base
                   font-bold text-accent-ink"
            aria-hidden="true"
            >{{ user.name.charAt(0).toUpperCase() }}</span
          >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-fg">{{ user.name }}</p>
            <p class="truncate text-[11px] text-fg-subtle">{{ user.email }}</p>
          </div>
        </section>
      }

      <!-- Appearance ------------------------------------------------- -->
      <section class="card p-4">
        <h2 class="mb-1 text-sm font-bold text-fg">Appearance</h2>
        <p class="mb-3 text-[11px] text-fg-subtle">
          System follows whatever your phone is set to, including its night schedule.
        </p>
        <app-theme-choice />
      </section>

      <nav class="card divide-y divide-line overflow-hidden">
        @for (link of links; track link.path) {
          <a [routerLink]="link.path" class="tap flex items-center gap-3 p-4 active:bg-hover">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sunken text-fg-muted"
            >
              <app-icon [name]="link.icon" [size]="18" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-fg">{{ link.label }}</span>
              <span class="block text-[11px] text-fg-subtle">{{ link.hint }}</span>
            </span>
            <span class="shrink-0 text-fg-subtle"
              ><app-icon name="chevron-right" [size]="18"
            /></span>
          </a>
        }
      </nav>

      <section class="card p-4">
        <h2 class="mb-2 text-sm font-bold text-fg">How this works</h2>
        <ul class="space-y-2.5 text-[11px] leading-relaxed text-fg-muted">
          <li>
            <strong class="font-semibold text-fg">No accounts, no balances.</strong> This is a
            spending log — record what you spent and how you paid. Nothing can ever refuse an entry.
          </li>
          <li>
            <strong class="font-semibold text-fg">Receipts are never stored.</strong> The photo goes
            to Gemini, the numbers come back, and the image is discarded. Only what you approve is
            saved.
          </li>
          <li>
            <strong class="font-semibold text-fg">Cash vs online</strong> is tracked on every entry,
            so the dashboard can show where your spending actually goes.
          </li>
        </ul>
      </section>

      <button type="button" (click)="signOut()" class="btn-quiet w-full py-3.5 text-spend">
        <app-icon name="logout" [size]="17" />
        Sign out
      </button>
    </div>
  `,
  styles: `
    .avatar {
      background-image: linear-gradient(
        140deg,
        color-mix(in oklab, var(--color-accent) 82%, white),
        var(--color-accent)
      );
    }
  `,
})
export class Settings {
  protected readonly auth = inject(AuthService);

  protected signOut(): void {
    this.auth.logout();
  }

  protected readonly links: { path: string; label: string; icon: IconName; hint: string }[] = [
    { path: '/add', label: 'Add a spend', icon: 'plus', hint: 'Type it in or scan a receipt' },
    {
      path: '/transactions',
      label: 'All transactions',
      icon: 'receipt',
      hint: 'Search and filter everything',
    },
    { path: '/', label: 'Dashboard', icon: 'chart', hint: 'Charts and totals' },
    { path: '/milk', label: 'Milk log', icon: 'milk', hint: 'How much milk, day by day' },
  ];
}

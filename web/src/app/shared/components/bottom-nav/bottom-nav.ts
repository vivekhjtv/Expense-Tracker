import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact: boolean;
}

/**
 * Fixed bottom tab bar — the primary navigation on a phone, where the top of
 * the screen is out of thumb reach.
 *
 * Adding a spend is a floating action button rather than a tab: it is the
 * thing this app exists for, so it gets the largest target in the easiest
 * corner to reach one-handed, instead of competing with navigation.
 */
@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- FAB sits above the bar so it never covers a tab's hit area. -->
    <a
      routerLink="/add"
      aria-label="Add a spend"
      class="tap fixed right-4 z-50 flex size-14 items-center justify-center rounded-full
             bg-brand-600 text-3xl leading-none text-white shadow-lg shadow-brand-600/30
             transition active:scale-95 active:bg-brand-700"
      style="bottom: calc(5.25rem + env(safe-area-inset-bottom))"
    >
      <span aria-hidden="true" class="-mt-0.5">+</span>
    </a>

    <nav
      class="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 backdrop-blur-sm"
      style="padding-bottom: env(safe-area-inset-bottom)"
      aria-label="Primary"
    >
      <div class="mx-auto grid max-w-md grid-cols-3 px-2 py-1.5">
        @for (item of items; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="text-brand-600"
            [routerLinkActiveOptions]="{ exact: item.exact }"
            #rla="routerLinkActive"
            [attr.aria-current]="rla.isActive ? 'page' : null"
            class="tap flex flex-col items-center gap-0.5 rounded-lg py-1 text-ink-400 transition-colors active:bg-ink-100"
          >
            <span class="text-xl leading-none" aria-hidden="true">{{ item.icon }}</span>
            <span class="text-[10px] font-medium">{{ item.label }}</span>
          </a>
        }
      </div>
    </nav>
  `,
})
export class BottomNav {
  protected readonly items: NavItem[] = [
    { path: '/', label: 'Home', icon: '📊', exact: true },
    { path: '/ledger', label: 'Ledger', icon: '🧾', exact: false },
    { path: '/settings', label: 'More', icon: '⚙️', exact: false },
  ];
}

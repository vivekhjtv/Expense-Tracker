import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Icon, IconName } from '../icon/icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
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
  imports: [RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- FAB sits above the bar so it never covers a tab's hit area, and
         disappears on the screen it leads to: on the add form it sat directly
         on top of the sticky Save button, which is both redundant and the
         worst possible thing to cover. -->
    @if (showFab()) {
      <a
        routerLink="/add"
        aria-label="Add a spend"
        class="fab tap fixed right-4 z-50 flex size-14 items-center justify-center rounded-2xl
             text-accent-ink transition active:scale-95"
        style="bottom: calc(5.25rem + env(safe-area-inset-bottom))"
      >
        <app-icon name="plus" [size]="26" [weight]="2.25" />
      </a>
    }

    <nav
      class="surface-blur fixed inset-x-0 bottom-0 z-40 border-t border-line"
      style="padding-bottom: env(safe-area-inset-bottom)"
      aria-label="Primary"
    >
      <div class="mx-auto grid max-w-md grid-cols-3 px-2 py-1.5">
        @for (item of items; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="is-active"
            [routerLinkActiveOptions]="{ exact: item.exact }"
            #rla="routerLinkActive"
            [attr.aria-current]="rla.isActive ? 'page' : null"
            class="tap relative flex flex-col items-center justify-center gap-1 rounded-xl py-1.5
                   text-fg-subtle transition-colors"
          >
            <!-- The active pill sits behind the icon rather than recolouring
                 the whole tab: at 10px the label alone is not a strong enough
                 signal of where you are. -->
            <span
              class="pill absolute inset-x-3 top-0.5 h-8 rounded-lg opacity-0 transition"
            ></span>
            <span class="relative"><app-icon [name]="item.icon" [size]="21" /></span>
            <span class="relative text-[10px] font-semibold tracking-tight">{{ item.label }}</span>
          </a>
        }
      </div>
    </nav>
  `,
  styles: `
    .fab {
      background-image: linear-gradient(
        140deg,
        color-mix(in oklab, var(--color-accent) 88%, white),
        var(--color-accent)
      );
      box-shadow:
        0 6px 20px -4px color-mix(in oklab, var(--color-accent) 60%, transparent),
        0 2px 6px -2px rgb(0 0 0 / 0.25);
    }

    .is-active {
      color: var(--color-accent-fg);
    }

    .is-active .pill {
      opacity: 1;
      background-color: var(--color-accent-soft);
    }
  `,
})
export class BottomNav {
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly showFab = computed(
    () => !this.url().startsWith('/add') && !this.url().startsWith('/edit'),
  );

  protected readonly items: NavItem[] = [
    { path: '/', label: 'Home', icon: 'chart', exact: true },
    { path: '/transactions', label: 'Transactions', icon: 'receipt', exact: false },
    { path: '/settings', label: 'More', icon: 'sliders', exact: false },
  ];
}

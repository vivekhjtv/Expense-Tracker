import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { LoadingService } from './core/services/loading.service';
import { BottomNav } from './shared/components/bottom-nav/bottom-nav';
import { ToastHost } from './shared/components/toast-host/toast-host';

/**
 * App shell.
 *
 * The viewport is capped at max-w-md and centred: this is a phone-first app,
 * and letting the layout stretch across a desktop window would leave a form
 * with 1200px-wide inputs. On a large screen it simply renders as a phone.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BottomNav, ToastHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Indeterminate top bar; the only global signal that a request is in flight. -->
    @if (loading.isLoading()) {
      <div class="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-accent-soft">
        <div class="h-full w-1/3 animate-[progress_1.1s_ease-in-out_infinite] bg-accent"></div>
      </div>
    }

    <app-toast-host />

    <div class="mx-auto min-h-dvh max-w-md">
      <!-- Bottom padding clears the fixed nav, but only when the nav is there. -->
      <main [style.padding-bottom]="showNav() ? 'calc(9.5rem + env(safe-area-inset-bottom))' : '0'">
        <router-outlet />
      </main>
    </div>

    @if (showNav()) {
      <app-bottom-nav />
    }
  `,
  styles: `
    @keyframes progress {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(400%);
      }
    }
  `,
})
export class App {
  protected readonly loading = inject(LoadingService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Navigation is meaningless on the sign-in screen, and it would leak the
      app's structure to someone who is not signed in. */
  protected readonly showNav = computed(
    () => this.auth.isAuthenticated() && !this.url().startsWith('/login'),
  );
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { Icon } from '../icon/icon';

/**
 * One-tap light/dark switch for the app header.
 *
 * It shows the theme you would GET, not the one you are in: in light mode it
 * shows a moon. A switch that pictures the current state reads as a status
 * light and people tap it expecting nothing to happen.
 *
 * The three-way choice (including "follow system") lives in Settings —
 * putting a segmented control in a header is a lot of chrome for something
 * most people set once.
 */
@Component({
  selector: 'app-theme-toggle',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="theme.toggle()"
      [attr.aria-label]="theme.isDark() ? 'Switch to light theme' : 'Switch to dark theme'"
      class="tap flex size-10 items-center justify-center rounded-full text-fg-muted transition
             active:bg-hover"
    >
      <!-- Keyed by name so the icon animates in rather than swapping paths
           under a static element. -->
      @if (theme.isDark()) {
        <span class="flex animate-[pop_240ms_var(--ease-out-soft)]">
          <app-icon name="sun" [size]="19" />
        </span>
      } @else {
        <span class="flex animate-[pop_240ms_var(--ease-out-soft)]">
          <app-icon name="moon" [size]="19" />
        </span>
      }
    </button>
  `,
  styles: `
    @keyframes pop {
      from {
        opacity: 0;
        transform: rotate(-45deg) scale(0.7);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
}

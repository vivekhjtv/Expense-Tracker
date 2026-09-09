import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ThemeToggle } from '../theme/theme-toggle';

/**
 * The sticky screen header.
 *
 * Extracted because three screens were each spelling out the same sticky
 * translucent bar with its own safe-area padding, and they had already
 * drifted apart by a few pixels. One component means the theme toggle lands
 * in the same place on every screen, which is the whole point of putting it
 * in the chrome rather than burying it in Settings.
 *
 * Projected content after the title takes the trailing slot; the toggle is
 * always last so its position never moves between screens.
 */
@Component({
  selector: 'app-header',
  imports: [ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="surface-blur sticky top-0 z-30 border-b border-line"
      style="padding-top: max(0.5rem, env(safe-area-inset-top))"
    >
      <div class="flex items-center gap-2 px-4 pb-2 pt-1">
        <ng-content select="[slot=lead]" />

        <div class="min-w-0 flex-1">
          <h1 class="truncate text-[17px] font-bold tracking-tight text-fg">{{ title() }}</h1>
          @if (subtitle(); as sub) {
            <p class="truncate text-[11px] text-fg-subtle">{{ sub }}</p>
          }
        </div>

        <ng-content />

        @if (showThemeToggle()) {
          <app-theme-toggle />
        }
      </div>

      <ng-content select="[slot=below]" />
    </header>
  `,
})
export class AppHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly showThemeToggle = input(true);
}

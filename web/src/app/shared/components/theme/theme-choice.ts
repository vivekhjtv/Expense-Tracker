import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemePreference, ThemeService } from '../../../core/services/theme.service';
import { Icon, IconName } from '../icon/icon';

/**
 * The full three-way theme preference, for Settings.
 *
 * "System" is a first-class option and the default, not a footnote — most
 * people have already made this decision at the OS level, and an app that
 * ignores it is an app that is bright white at 1am.
 */
@Component({
  selector: 'app-theme-choice',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1"
      role="radiogroup"
      aria-label="Theme"
    >
      @for (option of options; track option.value) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="theme.preference() === option.value"
          (click)="theme.set(option.value)"
          class="tap flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px]
                 font-semibold transition"
          [class]="
            theme.preference() === option.value
              ? 'segment-on text-fg'
              : 'text-fg-subtle active:bg-hover'
          "
        >
          <app-icon [name]="option.icon" [size]="17" />
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class ThemeChoice {
  protected readonly theme = inject(ThemeService);

  protected readonly options: { value: ThemePreference; label: string; icon: IconName }[] = [
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'system', label: 'System', icon: 'monitor' },
  ];
}

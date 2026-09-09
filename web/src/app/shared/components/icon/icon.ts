import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'chart'
  | 'receipt'
  | 'sliders'
  | 'plus'
  | 'arrow-left'
  | 'camera'
  | 'search'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'chevron-right'
  | 'chevron-left'
  | 'trash'
  | 'pencil'
  | 'check'
  | 'close'
  | 'logout'
  | 'cash'
  | 'phone'
  | 'sparkle'
  | 'alert'
  | 'calendar'
  | 'user';

/**
 * Icon set.
 *
 * Emoji were doing this job, and they are wrong for chrome: they carry their
 * own colour, so they cannot follow the theme, and every platform draws them
 * differently — the nav bar looked like a different app on Android than on
 * iOS. These are stroked paths on `currentColor`, so a nav item that turns
 * accent-coloured turns its icon with it, in both themes, for free.
 *
 * Emoji stay where they encode *data* rather than chrome: category glyphs in
 * the ledger and the picker, where the variety is the point.
 *
 * Paths follow the Lucide geometry (24×24 box, 2px stroke, round caps) so the
 * whole set shares one optical weight.
 */
@Component({
  selector: 'app-icon',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="weight()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
      class="shrink-0"
    >
      @switch (name()) {
        @case ('chart') {
          <path d="M3 21h18" />
          <path d="M6 21V11" />
          <path d="M12 21V4" />
          <path d="M18 21v-6" />
        }
        @case ('receipt') {
          <path d="M5 3h14v18l-2.3-1.6L14.4 21 12 19.4 9.6 21 7.3 19.4 5 21z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
        }
        @case ('sliders') {
          <path d="M4 21v-6M4 11V3M12 21v-9M12 8V3M20 21v-4M20 13V3" />
          <path d="M1.5 15h5M9.5 8h5M17.5 17h5" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('arrow-left') {
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        }
        @case ('camera') {
          <path
            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l2-3h6l2 3h3a2 2 0 0 1 2 2z"
          />
          <circle cx="12" cy="13" r="3.5" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7" />
          <path d="M20.5 20.5 16 16" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        }
        @case ('moon') {
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        }
        @case ('monitor') {
          <rect x="2" y="4" width="20" height="13" rx="2" />
          <path d="M8 21h8M12 17v4" />
        }
        @case ('chevron-right') {
          <path d="M9 18l6-6-6-6" />
        }
        @case ('chevron-left') {
          <path d="M15 18l-6-6 6-6" />
        }
        @case ('trash') {
          <path d="M3 6h18" />
          <path d="M9 6V4h6v2" />
          <path d="M6 6l1 14h10l1-14" />
          <path d="M10 11v5M14 11v5" />
        }
        @case ('pencil') {
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        }
        @case ('check') {
          <path d="M20 6 9 17l-5-5" />
        }
        @case ('close') {
          <path d="M18 6 6 18M6 6l12 12" />
        }
        @case ('logout') {
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        }
        @case ('cash') {
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 12h.01M18 12h.01" />
        }
        @case ('phone') {
          <rect x="6" y="2" width="12" height="20" rx="2.5" />
          <path d="M11 18h2" />
        }
        @case ('sparkle') {
          <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
          <path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
        }
        @case ('alert') {
          <path d="M12 3.5 22 20H2z" />
          <path d="M12 10v4M12 17.2h.01" />
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        }
        @case ('user') {
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  /** Small icons need a slightly heavier stroke to hold up at 16px. */
  readonly weight = input(1.75);
}

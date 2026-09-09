import { DOCUMENT, Injectable, computed, effect, inject, isDevMode, signal } from '@angular/core';

/** What the user chose. `system` is a live subscription, not a snapshot. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** What actually gets painted. `system` has been resolved away. */
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'expense-tracker.theme';

/** Matches the `--color-canvas` token in each theme, so the iOS status bar
 *  and Android URL bar blend into the page instead of framing it. */
const BAR_COLOR: Record<ResolvedTheme, string> = {
  light: '#f5f6f8',
  dark: '#0a0e17',
};

/**
 * Theme control.
 *
 * Three preferences, two outcomes. `system` is deliberately the default:
 * someone who has already told their phone they want dark at night should not
 * have to tell this app too.
 *
 * The <html data-theme> attribute is the single source of truth for the CSS —
 * see the dark block in styles.css. It is also written by an inline script in
 * index.html *before first paint*, because setting it from Angular alone means
 * a dark-mode user gets a full white screen for the length of a bundle
 * download. This service and that script must agree on the storage key.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly stored = signal<ThemePreference>(this.readStored());

  /** Tracks the OS setting live, so switching the phone to dark at sunset
   *  moves the app with it while the preference is `system`. */
  private readonly systemPrefersDark = signal(this.querySystemDark());

  readonly preference = this.stored.asReadonly();

  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.stored();
    if (preference !== 'system') return preference;
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  readonly isDark = computed(() => this.resolved() === 'dark');

  constructor() {
    const media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    // `change` fires only while the preference is `system` in effect — we keep
    // the signal accurate regardless, so flipping back to `system` is instant.
    media?.addEventListener('change', (event) => this.systemPrefersDark.set(event.matches));

    if (isDevMode()) this.warnIfPrePaintDisagrees();

    effect(() => this.apply(this.resolved()));
  }

  /**
   * The inline script in index.html reads the same storage key as this service
   * and paints the theme before the bundle loads. Nothing enforces that they
   * agree — they are coupled across a file boundary by a string. When they
   * drift, the app boots in one theme and snaps to the other on bootstrap: a
   * flash, with no error to explain it. Say so, loudly, in development.
   */
  private warnIfPrePaintDisagrees(): void {
    const painted = this.document.documentElement.getAttribute('data-theme');
    // No attribute means the script did not run (a test, or a host that
    // strips inline scripts) — not a mismatch.
    if (!painted || painted === this.resolved()) return;

    console.warn(
      `[ThemeService] The pre-paint script set data-theme="${painted}" but the ` +
        `stored preference resolves to "${this.resolved()}". The storage key in ` +
        `index.html and STORAGE_KEY here have drifted apart, so the app will ` +
        `flash the wrong theme on every load.`,
    );
  }

  set(preference: ThemePreference): void {
    this.stored.set(preference);
    try {
      this.document.defaultView?.localStorage?.setItem(STORAGE_KEY, preference);
    } catch {
      // Private browsing and storage-blocked contexts. The theme still applies
      // for this session; it just will not survive a reload.
    }
  }

  /** Flips to the opposite of what is currently on screen. From `system`, the
   *  first tap therefore does the visible thing rather than nothing. */
  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  private apply(theme: ResolvedTheme): void {
    const root = this.document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    const meta = this.document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', BAR_COLOR[theme]);
  }

  private readStored(): ThemePreference {
    try {
      const value = this.document.defaultView?.localStorage?.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
    } catch {
      return 'system';
    }
  }

  private querySystemDark(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}

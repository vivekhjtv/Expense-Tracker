import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme.service';

/** jsdom has no matchMedia, so every test states what the OS is asking for. */
function stubSystemDark(dark: boolean): (matches: boolean) => void {
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  let current = dark;

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('dark') ? current : false,
      media: query,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb),
      removeEventListener: () => {},
    })),
  );

  return (matches: boolean) => {
    current = matches;
    listeners.forEach((cb) => cb({ matches }));
  };
}

function makeService(): ThemeService {
  TestBed.resetTestingModule();
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    document.head.querySelector('meta[name="theme-color"]')?.remove();
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#ffffff');
    document.head.appendChild(meta);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('defaults to following the system, not to light', () => {
    stubSystemDark(true);
    const theme = makeService();

    expect(theme.preference()).toBe('system');
    expect(theme.resolved()).toBe('dark');
  });

  it('resolves system to light when the OS asks for light', () => {
    stubSystemDark(false);
    expect(makeService().resolved()).toBe('light');
  });

  it('lets an explicit choice override the system', () => {
    stubSystemDark(true);
    const theme = makeService();

    theme.set('light');

    expect(theme.resolved()).toBe('light');
    expect(theme.isDark()).toBe(false);
  });

  it('follows the OS live while the preference is system', () => {
    const setSystem = stubSystemDark(false);
    const theme = makeService();
    expect(theme.resolved()).toBe('light');

    setSystem(true);

    expect(theme.resolved()).toBe('dark');
  });

  it('stops following the OS once a theme is chosen', () => {
    const setSystem = stubSystemDark(false);
    const theme = makeService();
    theme.set('light');

    setSystem(true);

    expect(theme.resolved()).toBe('light');
  });

  it('toggling from system picks the OPPOSITE of what is on screen', () => {
    // The failure this guards: toggling from `system` while the OS is dark
    // must land on light. Storing "the opposite of the preference" instead of
    // "the opposite of the resolved theme" would set dark — and nothing on
    // screen would change, so the button would look broken.
    stubSystemDark(true);
    const theme = makeService();

    theme.toggle();

    expect(theme.preference()).toBe('light');
    expect(theme.resolved()).toBe('light');
  });

  it('writes data-theme and color-scheme onto the root element', () => {
    stubSystemDark(false);
    const theme = makeService();
    theme.set('dark');
    // The DOM write happens in an effect, so it lands on the next flush
    // rather than inside set(). Nothing visible depends on it being
    // synchronous — the inline script has already painted the first frame.
    TestBed.tick();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    // Native controls — date pickers, selects, scrollbars — read this, not
    // our custom properties.
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('repaints the browser chrome to match the canvas', () => {
    stubSystemDark(false);
    const theme = makeService();

    theme.set('dark');
    TestBed.tick();
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#0a0e17',
    );

    theme.set('light');
    TestBed.tick();
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#f5f6f8',
    );
  });

  it('persists the choice and restores it on the next visit', () => {
    stubSystemDark(true);
    makeService().set('light');

    const next = makeService();

    expect(next.preference()).toBe('light');
    expect(next.resolved()).toBe('light');
  });

  it('ignores a corrupted stored value rather than throwing', () => {
    stubSystemDark(true);
    localStorage.setItem('expense-tracker.theme', 'neon');

    expect(makeService().preference()).toBe('system');
  });

  it('still applies a theme when storage is blocked', () => {
    // Private browsing and some embedded webviews throw on setItem. Losing
    // persistence is acceptable; throwing on a tap is not.
    stubSystemDark(false);
    const theme = makeService();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => theme.set('dark')).not.toThrow();
    expect(theme.resolved()).toBe('dark');

    setItem.mockRestore();
  });
});

describe('pre-paint agreement', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('warns when the inline script painted a different theme than it resolves', () => {
    // The inline script in index.html and this service share a storage key
    // across a file boundary with nothing to enforce it. If they drift, the
    // app boots in the wrong theme and snaps to the right one once Angular
    // starts — a flash with no error to explain it. This turns that silent
    // drift into a console warning naming both values.
    stubSystemDark(false);
    document.documentElement.setAttribute('data-theme', 'dark');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    makeService();

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0].join(' ')).toContain('data-theme');
    warn.mockRestore();
  });

  it('stays quiet when the two agree', () => {
    stubSystemDark(true);
    document.documentElement.setAttribute('data-theme', 'dark');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    makeService();

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays quiet on a first paint with no attribute at all', () => {
    stubSystemDark(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    makeService();

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

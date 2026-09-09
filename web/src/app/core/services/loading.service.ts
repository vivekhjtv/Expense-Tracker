import { computed, Injectable, signal } from '@angular/core';

/**
 * Counts in-flight requests. A counter rather than a boolean, because two
 * overlapping requests must not have the first one to finish switch the
 * progress bar off while the second is still running.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly inFlight = signal(0);

  readonly isLoading = computed(() => this.inFlight() > 0);

  start(): void {
    this.inFlight.update((n) => n + 1);
  }

  stop(): void {
    this.inFlight.update((n) => Math.max(0, n - 1));
  }
}

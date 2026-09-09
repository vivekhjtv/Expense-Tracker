import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly toasts = signal<Toast[]>([]);

  success(message: string): void {
    this.push('success', message, 3000);
  }

  error(message: string): void {
    // Errors linger: they usually carry an instruction the user must read.
    this.push('error', message, 6000);
  }

  info(message: string): void {
    this.push('info', message, 4000);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: ToastKind, message: string, ttl: number): void {
    const id = this.nextId++;
    // Cap the stack — a burst of failures should not paper over the screen.
    this.toasts.update((list) => [...list.slice(-2), { id, kind, message }]);
    this.timers.set(id, setTimeout(() => this.dismiss(id), ttl));
  }
}

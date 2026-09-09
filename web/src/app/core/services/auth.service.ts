import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, of, tap } from 'rxjs';
import { AuthResult, AuthUser } from '../models/auth.model';

const TOKEN_KEY = 'et.token';
const USER_KEY = 'et.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly userState = signal<AuthUser | null>(readStoredUser());
  private token: string | null = readStored(TOKEN_KEY);

  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => this.userState() !== null);

  /**
   * The token is read synchronously by the interceptor on every request, so
   * it is kept in a field rather than behind an async storage read.
   */
  getToken(): string | null {
    return this.token;
  }

  register(name: string, email: string, password: string): Observable<AuthResult> {
    return this.http
      .post<AuthResult>('/api/auth/register', { name, email, password })
      .pipe(tap((result) => this.accept(result)));
  }

  login(email: string, password: string): Observable<AuthResult> {
    return this.http
      .post<AuthResult>('/api/auth/login', { email, password })
      .pipe(tap((result) => this.accept(result)));
  }

  /**
   * Confirms a stored token is still valid before the app renders a signed-in
   * shell. A token can be expired or signed with a rotated secret, and finding
   * that out on the first data request means flashing the UI then bouncing.
   */
  restore(): Observable<AuthUser | null> {
    if (!this.token) {
      return of(null);
    }

    return this.http.get<AuthUser>('/api/auth/me').pipe(
      tap((user) => {
        this.userState.set(user);
        write(USER_KEY, JSON.stringify(user));
      }),
      catchError(() => {
        this.clear();
        return of(null);
      }),
    );
  }

  logout(redirect = true): void {
    this.clear();
    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  private accept(result: AuthResult): void {
    this.token = result.accessToken;
    this.userState.set(result.user);
    write(TOKEN_KEY, result.accessToken);
    write(USER_KEY, JSON.stringify(result.user));
  }

  private clear(): void {
    this.token = null;
    this.userState.set(null);
    remove(TOKEN_KEY);
    remove(USER_KEY);
  }
}

/* localStorage throws in some privacy modes, so every access is guarded —
   a storage failure must degrade to "signed out", never crash the app. */

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStoredUser(): AuthUser | null {
  const raw = readStored(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Session simply will not survive a reload. */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

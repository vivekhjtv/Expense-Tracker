import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Attaches the bearer token and reacts to rejection.
 *
 * A 401 on any request means the token is gone or expired, so the session is
 * cleared and the user is sent to sign in. The auth endpoints themselves are
 * excluded: a wrong password there is an expected answer to render inline,
 * not a reason to bounce a user who was never signed in.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isAuthEndpoint = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/register');
  const token = auth.getToken();

  const request =
    token && !isAuthEndpoint
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        auth.logout();
      }
      return throwError(() => error);
    }),
  );
};

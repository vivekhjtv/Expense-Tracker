import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Blocks a route until the session is known to be valid.
 *
 * When a token exists but has not been checked this run, it is verified
 * against the API first. Rendering the dashboard optimistically and bouncing
 * a second later on the first 401 is a worse experience than a brief wait.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const redirect = () =>
    router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  if (auth.isAuthenticated()) {
    return true;
  }

  if (!auth.getToken()) {
    return redirect();
  }

  return auth.restore().pipe(map((user) => (user ? true : redirect())));
};

/** Keeps a signed-in user off the login screen. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};

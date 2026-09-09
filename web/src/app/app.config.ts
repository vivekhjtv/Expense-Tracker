import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { apiUrlInterceptor } from './core/interceptors/api-url.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // Binds route params/query to component inputs, so the transactions list's filters
      // can live in the URL and stay shareable and back-button friendly.
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(
      withFetch(),
      // Order matters and is outside-in: apiUrl rewrites the URL first, auth
      // attaches the token to the final URL, loading counts the request that
      // is actually going out, and error sits innermost so it sees the real
      // failure before anything else unwinds.
      withInterceptors([apiUrlInterceptor, authInterceptor, loadingInterceptor, errorInterceptor]),
    ),
  ],
};

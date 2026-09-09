import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Base URL for the API.
 *
 * Empty in development, meaning "same origin": `proxy.conf.json` forwards
 * /api to localhost:3000, so there is no CORS and no hostname in the bundle.
 *
 * In production the value comes from `environment.production.ts`, swapped in
 * at build time by the `fileReplacements` entry in angular.json — the
 * frontend and the API are deployed to different hosts, so the absolute
 * origin has to be compiled in.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

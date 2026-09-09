/**
 * Development. `apiBaseUrl` is empty so requests stay relative and
 * `proxy.conf.json` forwards /api to localhost:3000 — no CORS in dev.
 */
export const environment = {
  production: false,
  apiBaseUrl: '',
};

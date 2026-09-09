/**
 * Production.
 *
 * The API lives on a different host to the frontend (Vercel serves the static
 * app; the NestJS server runs elsewhere), so the built bundle needs the API's
 * absolute URL baked in. Set this to your deployed API origin, with NO
 * trailing slash and no /api suffix — the interceptor appends the path.
 *
 *   e.g. 'https://expense-tracker-api.onrender.com'
 *
 * The matching CORS_ORIGINS value on the API must list this app's origin.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://REPLACE-ME.onrender.com',
};

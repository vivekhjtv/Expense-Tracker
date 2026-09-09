import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';

/**
 * Prefixes relative /api requests with the configured base URL, so services
 * can be written against clean relative paths and the deployment target stays
 * a single injectable value.
 */
export const apiUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(API_BASE_URL);

  if (!baseUrl || !req.url.startsWith('/api')) {
    return next(req);
  }

  return next(req.clone({ url: `${baseUrl.replace(/\/$/, '')}${req.url}` }));
};

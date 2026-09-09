import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, throwError, timer } from 'rxjs';
import { ToastService } from '../services/toast.service';

/** The error envelope produced by the API's AllExceptionsFilter. */
interface ApiErrorBody {
  statusCode: number;
  message: string;
  error: string;
  details?: string[];
}

/** A thrown error the UI can render directly. */
export class ApiError extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 409 means a business rule refused — insufficient cash, over credit limit. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    // Retry only GETs, and only on transport/5xx failures. Retrying a POST
    // could double-record an expense, and retrying a 4xx just repeats a
    // request the server has already refused on its merits.
    retry({
      count: req.method === 'GET' ? 2 : 0,
      delay: (error: unknown, retryCount: number) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const isRetryable = status === 0 || status >= 500;
        if (!isRetryable) {
          return throwError(() => error);
        }
        return timer(retryCount * 600);
      },
    }),
    catchError((error: HttpErrorResponse) => {
      const apiError = toApiError(error);

      // Validation errors are rendered inline against the offending field, so
      // a toast on top of that would just be duplicate noise.
      if (!apiError.isValidation) {
        toast.error(apiError.message);
      }

      return throwError(() => apiError);
    }),
  );
};

function toApiError(error: HttpErrorResponse): ApiError {
  // status 0 = the request never reached the server.
  if (error.status === 0) {
    return new ApiError(
      'Cannot reach the server. Check your connection and try again.',
      0,
    );
  }

  const body = error.error as ApiErrorBody | string | null;

  if (body && typeof body === 'object' && typeof body.message === 'string') {
    return new ApiError(body.message, error.status, body.details ?? []);
  }

  if (typeof body === 'string' && body.trim()) {
    return new ApiError(body, error.status);
  }

  return new ApiError(
    error.status >= 500
      ? 'The server ran into a problem. Please try again.'
      : 'Something went wrong.',
    error.status,
  );
}

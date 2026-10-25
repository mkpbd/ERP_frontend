import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, retry, throwError, timer } from 'rxjs';
import { toApiError } from '../http/api-error';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TRANSIENT_STATUSES = new Set([0, 502, 503, 504]);
const MAX_RETRIES = 2;

/**
 * Retries idempotent requests on transient failures (network drop, gateway errors) with backoff, then
 * converts every error into an `ApiError`. Writes are never retried automatically: replaying a POST
 * could create a record twice.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const retryable = SAFE_METHODS.has(request.method);
  return next(request).pipe(
    retry({
      count: retryable ? MAX_RETRIES : 0,
      delay: (error: unknown, attempt) =>
        error instanceof HttpErrorResponse && TRANSIENT_STATUSES.has(error.status)
          ? timer(300 * 2 ** (attempt - 1))
          : throwError(() => error),
    }),
    catchError((error: unknown) => throwError(() => toApiError(error))),
  );
};

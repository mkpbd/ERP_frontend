import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL, isApiUrl } from '../config/api-config';

/**
 * Tags each API call with an X-Correlation-Id. The backend echoes it in responses, logs and audit rows,
 * and retries of the same call keep the same id, so one user action can be traced end to end.
 */
export const correlationIdInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiUrl(request.url, inject(API_BASE_URL)) || request.headers.has('X-Correlation-Id')) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { 'X-Correlation-Id': crypto.randomUUID() } }));
};

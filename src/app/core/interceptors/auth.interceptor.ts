import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Observable, of, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL, isApiUrl } from '../config/api-config';
import { ApiError } from '../http/api-error';
import { SKIP_AUTH } from '../http/http-context';

function withBearer(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}

/** A failed refresh means the session is over, unless the network or the server was the problem. */
function sessionIsGone(error: unknown): boolean {
  return !(error instanceof ApiError) || (!error.isNetworkError && !error.isServerError);
}

/**
 * Attaches the in-memory access token to API requests. On 401 it refreshes once (sharing the refresh
 * with concurrent requests) and replays the request. The replay goes straight to `next` and the refresh
 * request is marked SKIP_AUTH, so a rejected token can never start a refresh loop.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  if (request.context.get(SKIP_AUTH) || !isApiUrl(request.url, inject(API_BASE_URL))) return next(request);

  const sentToken = auth.accessToken();
  return next(withBearer(request, sentToken)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !sentToken) {
        return throwError(() => error);
      }
      // Another request may have refreshed while this one was in flight; reuse its token.
      const current = auth.accessToken();
      const token$: Observable<string> =
        current && current !== sentToken ? of(current) : auth.refreshSession();
      return token$.pipe(
        catchError((refreshError: unknown) => {
          if (sessionIsGone(refreshError)) auth.expireSession();
          return throwError(() => error);
        }),
        switchMap((token) => next(withBearer(request, token))),
      );
    }),
  );
};

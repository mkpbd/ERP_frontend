import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  defer,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiError } from '../http/api-error';
import { AuthApi } from './auth-api.service';
import type { AuthStatus, CurrentUser, LoginRequest } from './auth.models';
import { CSRF_COOKIE, readCookie } from './cookies';
import { createAuthChannel, withCrossTabLock } from './cross-tab';

const REFRESH_LOCK = 'erp-auth-refresh';

/**
 * Owns the browser session.
 *
 * Token strategy: the access token (15 min) lives only in memory, so injected script cannot lift it from
 * storage and it disappears with the tab. The refresh token is an HttpOnly, SameSite=Strict cookie the
 * frontend never sees; after a reload the session is restored by refreshing with that cookie plus the
 * double-submit CSRF token. Nothing sensitive is written to localStorage or sessionStorage.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);

  private readonly accessTokenState = signal<string | null>(null);
  private readonly userState = signal<CurrentUser | null>(null);
  private readonly statusState = signal<AuthStatus>('unknown');

  readonly accessToken = this.accessTokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly isAuthenticated = computed(() => this.statusState() === 'authenticated');
  readonly permissions = computed<ReadonlySet<string>>(() => new Set(this.userState()?.permissions ?? []));

  private refreshInFlight: Observable<string> | null = null;
  private readonly channel = createAuthChannel((message) => {
    if (message === 'logout' && this.statusState() === 'authenticated') this.endSession();
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.channel.close());
  }

  /** Runs once at startup. Restores the session from the refresh cookie when there is one; never throws. */
  async restoreSession(): Promise<void> {
    if (!readCookie(CSRF_COOKIE)) {
      this.statusState.set('anonymous');
      return;
    }
    try {
      await firstValueFrom(this.refreshSession().pipe(switchMap(() => this.loadUser())));
    } catch {
      this.clear();
    }
  }

  login(request: LoginRequest): Observable<CurrentUser> {
    return this.api.login(request).pipe(
      tap((tokens) => this.accessTokenState.set(tokens.accessToken)),
      switchMap(() => this.loadUser()),
      catchError((error: unknown) => {
        this.clear();
        return throwError(() => error);
      }),
    );
  }

  /** Re-reads the profile, roles and permissions (after editing the profile or changing role grants). */
  reloadUser(): Observable<CurrentUser> {
    return this.loadUser();
  }

  /**
   * Exchanges the refresh cookie for a new access token. Concurrent callers share one request, and tabs
   * take turns through a Web Lock, because the backend revokes the session when a refresh token is replayed.
   */
  refreshSession(): Observable<string> {
    this.refreshInFlight ??= defer(() =>
      withCrossTabLock(REFRESH_LOCK, () => {
        // Read inside the lock: another tab may have just rotated the cookies.
        const csrf = readCookie(CSRF_COOKIE);
        if (!csrf)
          return Promise.reject(new ApiError(401, 'invalid_refresh_token', 'Your session has ended.'));
        return firstValueFrom(this.api.refresh(csrf));
      }),
    ).pipe(
      map((tokens) => tokens.accessToken),
      tap((token) => this.accessTokenState.set(token)),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight;
  }

  /** The refresh token was rejected: drop local state and send the user to sign in again. */
  expireSession(): void {
    if (this.statusState() !== 'authenticated') {
      this.clear();
      return;
    }
    const returnUrl = this.router.url;
    this.clear();
    void this.router.navigate(['/login'], { queryParams: { reason: 'expired', returnUrl } });
  }

  /** Revokes the session server-side (best effort), then clears local state in every tab. */
  logout(): Observable<void> {
    const revoke = this.accessTokenState()
      ? this.api.logout().pipe(catchError(() => of(undefined)))
      : of(undefined);
    return revoke.pipe(
      map(() => undefined),
      finalize(() => {
        this.channel.post('logout');
        this.endSession();
      }),
    );
  }

  /** Local sign-out without calling the API (the session is already gone, e.g. after "sign out everywhere"). */
  endSession(): void {
    this.clear();
    void this.router.navigate(['/login']);
  }

  private loadUser(): Observable<CurrentUser> {
    return this.api.currentUser().pipe(
      tap((user) => {
        this.userState.set(user);
        this.statusState.set('authenticated');
      }),
    );
  }

  private clear(): void {
    this.accessTokenState.set(null);
    this.userState.set(null);
    this.statusState.set('anonymous');
  }
}

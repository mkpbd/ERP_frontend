import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import type { CurrentUser, TokenResponse } from '../auth/auth.models';
import { ApiError } from '../http/api-error';
import { publicRequest } from '../http/http-context';
import { authInterceptor } from './auth.interceptor';
import { correlationIdInterceptor } from './correlation-id.interceptor';
import { errorInterceptor } from './error.interceptor';

const API = '/api/v1';

const tokens = (accessToken: string): TokenResponse => ({
  accessToken,
  tokenType: 'Bearer',
  expiresIn: 900,
  accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
  refreshTokenExpiresAt: '2030-01-31T00:00:00.000Z',
});

const user: CurrentUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@example.com',
  username: null,
  displayName: 'Admin User',
  status: 'active',
  emailVerified: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  roles: ['super-admin'],
  permissions: ['users:read'],
};

/** Lets promise-based steps (the refresh runs inside a Web Lock / promise) settle. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

function setCookie(value: string): void {
  document.cookie = value;
}

describe('authentication flow (AuthService + interceptors)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([correlationIdInterceptor, errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    setCookie('erp_csrf=csrf-1; path=/');
  });

  afterEach(() => {
    httpMock.verify();
    setCookie('erp_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/');
  });

  async function signIn(accessToken = 'token-1'): Promise<void> {
    const done = firstValueFrom(auth.login({ identifier: 'admin@example.com', password: 'secret' }));
    const login = httpMock.expectOne(`${API}/auth/login`);
    expect(login.request.headers.has('Authorization')).toBe(false);
    expect(login.request.withCredentials).toBe(true);
    login.flush(tokens(accessToken));
    const me = httpMock.expectOne(`${API}/users/me`);
    expect(me.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    me.flush(user);
    await done;
  }

  function unauthorized(request: TestRequest): void {
    request.flush(
      { code: 'token_expired', detail: 'Access token has expired' },
      { status: 401, statusText: 'Unauthorized' },
    );
  }

  it('signs in, keeps the token in memory and exposes the user and permissions', async () => {
    await signIn();
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken()).toBe('token-1');
    expect(auth.permissions().has('users:read')).toBe(true);
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('adds a correlation id to API calls only', async () => {
    http.get(`${API}/roles`).subscribe();
    http.get('https://cdn.example.com/x.json').subscribe();
    expect(httpMock.expectOne(`${API}/roles`).request.headers.get('X-Correlation-Id')).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(httpMock.expectOne('https://cdn.example.com/x.json').request.headers.has('X-Correlation-Id')).toBe(
      false,
    );
  });

  it('refreshes once on 401 and replays the request with the new token', async () => {
    await signIn();
    let body: unknown;
    http.get(`${API}/users`).subscribe((value) => (body = value));

    unauthorized(httpMock.expectOne(`${API}/users`));
    await settle();

    const refresh = httpMock.expectOne(`${API}/auth/refresh`);
    expect(refresh.request.headers.get('X-CSRF-Token')).toBe('csrf-1');
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(tokens('token-2'));
    await settle();

    const replay = httpMock.expectOne(`${API}/users`);
    expect(replay.request.headers.get('Authorization')).toBe('Bearer token-2');
    replay.flush({ items: [] });
    expect(body).toEqual({ items: [] });
  });

  it('shares one refresh between concurrent 401s', async () => {
    await signIn();
    http.get(`${API}/users`).subscribe();
    http.get(`${API}/roles`).subscribe();
    unauthorized(httpMock.expectOne(`${API}/users`));
    unauthorized(httpMock.expectOne(`${API}/roles`));
    await settle();

    httpMock.expectOne(`${API}/auth/refresh`).flush(tokens('token-2'));
    await settle();

    for (const url of [`${API}/users`, `${API}/roles`]) {
      const replay = httpMock.expectOne(url);
      expect(replay.request.headers.get('Authorization')).toBe('Bearer token-2');
      replay.flush([]);
    }
  });

  it('ends the session when the refresh is rejected, without looping', async () => {
    await signIn();
    let failure: unknown;
    http.get(`${API}/users`).subscribe({ error: (error: unknown) => (failure = error) });

    unauthorized(httpMock.expectOne(`${API}/users`));
    await settle();
    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush({ code: 'invalid_refresh_token' }, { status: 401, statusText: 'Unauthorized' });
    await settle();

    httpMock.expectNone(`${API}/auth/refresh`);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(401);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.accessToken()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/login'],
      expect.objectContaining({ queryParams: expect.objectContaining({ reason: 'expired' }) }),
    );
  });

  it('keeps the session when the refresh fails because of the network', async () => {
    await signIn();
    http.get(`${API}/roles`).subscribe({ error: () => undefined });
    unauthorized(httpMock.expectOne(`${API}/roles`));
    await settle();
    httpMock.expectOne(`${API}/auth/refresh`).error(new ProgressEvent('error'), { status: 0 });
    await settle();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('never attaches the token to public requests', async () => {
    await signIn();
    http.post(`${API}/auth/forgot-password`, { email: 'a@b.c' }, { context: publicRequest() }).subscribe();
    expect(httpMock.expectOne(`${API}/auth/forgot-password`).request.headers.has('Authorization')).toBe(
      false,
    );
  });

  it('restores the session from the refresh cookie at startup', async () => {
    const restored = auth.restoreSession();
    await settle();
    httpMock.expectOne(`${API}/auth/refresh`).flush(tokens('token-r'));
    await settle();
    httpMock.expectOne(`${API}/users/me`).flush(user);
    await restored;
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken()).toBe('token-r');
  });

  it('starts anonymous without calling the API when there is no session cookie', async () => {
    setCookie('erp_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/');
    await auth.restoreSession();
    expect(auth.status()).toBe('anonymous');
    httpMock.expectNone(`${API}/auth/refresh`);
  });

  it('logout revokes the session and clears local state even if the call fails', async () => {
    await signIn();
    const done = firstValueFrom(auth.logout(), { defaultValue: undefined });
    httpMock.expectOne(`${API}/auth/logout`).flush(null, { status: 500, statusText: 'Server Error' });
    await done;
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.user()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('retries idempotent requests on transient failures only', async () => {
    vi.useFakeTimers();
    try {
      http.get(`${API}/roles`).subscribe();
      httpMock.expectOne(`${API}/roles`).flush(null, { status: 503, statusText: 'Unavailable' });
      await vi.advanceTimersByTimeAsync(400);
      httpMock.expectOne(`${API}/roles`).flush([]);

      http.post(`${API}/roles`, {}).subscribe({ error: () => undefined });
      httpMock.expectOne(`${API}/roles`).flush(null, { status: 503, statusText: 'Unavailable' });
      await vi.advanceTimersByTimeAsync(2000);
      httpMock.expectNone(`${API}/roles`);
    } finally {
      vi.useRealTimers();
    }
  });
});

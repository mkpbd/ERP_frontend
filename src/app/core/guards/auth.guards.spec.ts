import { TestBed } from '@angular/core/testing';
import { CanMatchFn, provideRouter, Route, Router, UrlTree } from '@angular/router';
import { createAuthStub } from '../../../testing/auth-stub';
import { authGuard, guestGuard, requirePermissions } from './auth.guards';

describe('route guards', () => {
  function setup(permissions: string[], authenticated = true) {
    const { provider } = createAuthStub(permissions, authenticated);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provider] });
    return TestBed.inject(Router);
  }

  const runCanMatch = (guard: CanMatchFn) =>
    TestBed.runInInjectionContext(() => guard({} as Route, [{ path: 'users' } as never], {} as never));

  it('authGuard lets signed-in users through', () => {
    setup([]);
    expect(runCanMatch(authGuard)).toBe(true);
  });

  it('authGuard sends anonymous visitors to /login with a return URL', () => {
    const router = setup([], false);
    const result = runCanMatch(authGuard) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/login?returnUrl=%2Fusers');
  });

  it('guestGuard redirects signed-in users away from the login page', () => {
    const router = setup([]);
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never)) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/');
  });

  it('requirePermissions allows holders and sends others to /forbidden', () => {
    const router = setup(['users:read']);
    expect(runCanMatch(requirePermissions('users:read'))).toBe(true);
    const denied = runCanMatch(requirePermissions('users:read', 'users:create')) as UrlTree;
    expect(router.serializeUrl(denied)).toBe('/forbidden');
  });
});

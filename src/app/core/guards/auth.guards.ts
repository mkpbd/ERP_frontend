import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlSegment } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Authorization } from '../authorization/authorization.service';
import type { Permission } from '../authorization/permissions';

/** The URL being navigated to, for `returnUrl` (canMatch only receives the matched segments). */
function targetUrl(router: Router, segments: UrlSegment[]): string {
  const navigation = router.currentNavigation();
  return navigation
    ? router.serializeUrl(navigation.extractedUrl)
    : `/${segments.map((s) => s.path).join('/')}`;
}

/**
 * Protects the authenticated area. Uses canMatch so lazy feature bundles are not even matched for
 * anonymous visitors. The session is restored before the first navigation, so this check is synchronous.
 */
export const authGuard: CanMatchFn = (_route, segments) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: targetUrl(router, segments) } });
};

/** Keeps signed-in users away from the sign-in and recovery pages. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/']) : true;
};

/** Requires at least one of the listed permissions; otherwise shows the 403 page (a UX guard only). */
export function requireAnyPermission(...permissions: Permission[]): CanMatchFn {
  return () => {
    if (inject(Authorization).canAny(permissions)) return true;
    return inject(Router).createUrlTree(['/forbidden']);
  };
}

/**
 * Requires every listed permission; otherwise shows the 403 page. A UX guard only: the backend still
 * rejects any request the user is not allowed to make.
 */
export function requirePermissions(...permissions: Permission[]): CanMatchFn {
  return () => {
    if (inject(Authorization).canAll(permissions)) return true;
    return inject(Router).createUrlTree(['/forbidden']);
  };
}

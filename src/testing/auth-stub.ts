import { computed, signal } from '@angular/core';
import type { CurrentUser } from '../app/core/auth/auth.models';
import { AuthService } from '../app/core/auth/auth.service';

/** Minimal AuthService replacement for component/guard tests: set the user and permissions directly. */
export function createAuthStub(permissions: readonly string[] = [], authenticated = true) {
  const user = signal<CurrentUser | null>(
    authenticated
      ? {
          id: 'me',
          email: 'me@example.com',
          username: null,
          displayName: 'Test User',
          status: 'active',
          emailVerified: true,
          lastLoginAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          roles: [],
          permissions,
        }
      : null,
  );
  const stub = {
    user,
    isAuthenticated: computed(() => user() !== null),
    permissions: computed<ReadonlySet<string>>(() => new Set(user()?.permissions ?? [])),
    accessToken: signal<string | null>(authenticated ? 'token' : null),
    setPermissions(next: readonly string[]) {
      user.update((current) => (current ? { ...current, permissions: next } : current));
    },
  };
  return { stub, provider: { provide: AuthService, useValue: stub } };
}

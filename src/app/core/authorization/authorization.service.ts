import { inject, Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { hasAllPermissions, hasAnyPermission, type Permission } from './permissions';

/**
 * Permission checks for the UI (hiding actions, filtering navigation, guarding routes).
 * They are a convenience, not a security boundary: the backend authorizes every request.
 * Each method reads a signal, so calls from templates and `computed()` stay reactive.
 */
@Injectable({ providedIn: 'root' })
export class Authorization {
  private readonly auth = inject(AuthService);

  can(permission: Permission): boolean {
    return this.auth.permissions().has(permission);
  }

  canAll(permissions: readonly Permission[]): boolean {
    return hasAllPermissions(this.auth.permissions(), permissions);
  }

  canAny(permissions: readonly Permission[]): boolean {
    return hasAnyPermission(this.auth.permissions(), permissions);
  }
}

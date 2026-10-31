/**
 * Permission keys defined by the backend catalog (`access-control/domain/permission-catalog.ts`).
 * Keep this list in sync; the backend remains the only authority on what a user may do.
 */
export const PERMISSIONS = [
  'users:read',
  'users:create',
  'users:update',
  'users:deactivate',
  'sessions:revoke',
  'roles:read',
  'roles:create',
  'roles:update',
  'roles:delete',
  'permissions:read',
  'permissions:assign',
  'audit:read',
  'menus:read',
  'menus:manage',
  'menus:assign',
  'menus:access-all',
  'locations:manage',
  'masters:manage',
  'tenants:manage',
  'settings:manage',
  'reports:read',
  'reports:assign',
  'reports:access-all',
  'hr:read',
  'hr:manage',
  'hr-masters:manage',
  'leave:read',
  'leave:manage',
  'leave:approve-any',
  'roster:manage',
  'attendance:read',
  'attendance:enter',
  'attendance:approve',
  'attendance:ingest',
  'recruitment:read',
  'recruitment:manage',
  'payroll:read',
  'payroll:manage',
  'opd:read',
  'ipd:read',
  'ipd:admit',
  'ipd:bill',
  'ipd:manage',
  'ipd:discount',
  'patient:read',
  'emr:read',
  'emr:write',
  'emr:order',
  'rx:read',
  'rx:manage',
  'ot:read',
  'ot:request',
  'ot:schedule',
  'ot:note',
  'ot:manage',
  'lab:read',
  'lab:collect',
  'lab:result',
  'lab:verify',
  'lab:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function hasAllPermissions(granted: ReadonlySet<string>, required: readonly Permission[]): boolean {
  return required.every((permission) => granted.has(permission));
}

export function hasAnyPermission(granted: ReadonlySet<string>, required: readonly Permission[]): boolean {
  return required.length === 0 || required.some((permission) => granted.has(permission));
}

/** `users:read` → `users`. */
export function permissionResource(key: string): string {
  const separator = key.indexOf(':');
  return separator < 0 ? key : key.slice(0, separator);
}

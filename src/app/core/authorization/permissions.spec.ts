import { hasAllPermissions, hasAnyPermission, permissionResource } from './permissions';

describe('permission helpers', () => {
  const granted = new Set(['users:read', 'roles:read']);

  it('hasAllPermissions requires every permission', () => {
    expect(hasAllPermissions(granted, ['users:read', 'roles:read'])).toBe(true);
    expect(hasAllPermissions(granted, ['users:read', 'users:create'])).toBe(false);
    expect(hasAllPermissions(granted, [])).toBe(true);
  });

  it('hasAnyPermission requires at least one (or none listed)', () => {
    expect(hasAnyPermission(granted, ['users:create', 'roles:read'])).toBe(true);
    expect(hasAnyPermission(granted, ['users:create'])).toBe(false);
    expect(hasAnyPermission(granted, [])).toBe(true);
  });

  it('permissionResource extracts the resource', () => {
    expect(permissionResource('hr-masters:manage')).toBe('hr-masters');
    expect(permissionResource('odd')).toBe('odd');
  });
});

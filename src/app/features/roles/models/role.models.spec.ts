import { diffPermissions } from './role.models';

describe('diffPermissions', () => {
  it('computes grants and revokes', () => {
    expect(diffPermissions(['users:read', 'roles:read'], ['roles:read', 'audit:read'])).toEqual({
      grant: ['audit:read'],
      revoke: ['users:read'],
    });
  });

  it('is empty when nothing changed, regardless of order', () => {
    expect(diffPermissions(['a:b', 'c:d'], ['c:d', 'a:b'])).toEqual({ grant: [], revoke: [] });
  });
});

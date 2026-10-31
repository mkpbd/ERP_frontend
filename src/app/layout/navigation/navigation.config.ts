import type { Permission } from '../../core/authorization/permissions';

export interface NavItem {
  readonly label: string;
  /** Absolute router path. Omit for a pure group heading with children. */
  readonly route?: string;
  /** Material Symbols ligature. */
  readonly icon: string;
  /** Every listed permission is required to see the item. */
  readonly permissions?: readonly Permission[];
  /** At least one listed permission is required to see the item. */
  readonly anyPermissions?: readonly Permission[];
  readonly children?: readonly NavItem[];
  /** Active only on an exact URL match (default: also active on child routes). */
  readonly exact?: boolean;
  /** Extra visibility rule evaluated after the permission checks. */
  readonly visible?: (context: NavContext) => boolean;
}

export interface NavSection {
  readonly label?: string;
  readonly items: readonly NavItem[];
}

export interface NavContext {
  readonly permissions: ReadonlySet<string>;
}

/** Single source of truth for the sidebar. Route guards declare the same permissions in the feature routes. */
export const NAVIGATION: readonly NavSection[] = [
  {
    items: [{ label: 'Dashboard', route: '/dashboard', icon: 'dashboard', exact: true }],
  },
  {
    label: 'Hospital',
    items: [
      { label: 'OT board', route: '/ot', icon: 'medical_services', permissions: ['ot:read'], exact: true },
      { label: 'Operations', route: '/ot/cases', icon: 'list_alt', permissions: ['ot:read'] },
      { label: 'OT setup', route: '/ot/setup', icon: 'tune', permissions: ['ot:read'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', route: '/users', icon: 'group', permissions: ['users:read'] },
      { label: 'Roles', route: '/roles', icon: 'badge', permissions: ['roles:read'] },
      { label: 'Permissions', route: '/permissions', icon: 'key', permissions: ['permissions:read'] },
      { label: 'Audit log', route: '/audit', icon: 'history', permissions: ['audit:read'] },
    ],
  },
  {
    label: 'Account',
    items: [{ label: 'Settings', route: '/settings', icon: 'manage_accounts' }],
  },
];

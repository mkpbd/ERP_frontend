import { filterNavigation } from './navigation-filter';
import { NAVIGATION, NavSection } from './navigation.config';

const labels = (sections: NavSection[]) =>
  sections.flatMap((section) => section.items.map((item) => item.label));

describe('filterNavigation', () => {
  it('shows only unrestricted items to a user without permissions', () => {
    const visible = filterNavigation(NAVIGATION, { permissions: new Set() });
    expect(labels(visible)).toEqual(['Dashboard', 'Settings']);
    expect(visible.some((section) => section.label === 'Administration')).toBe(false);
  });

  it('shows the items an auditor may use', () => {
    const visible = filterNavigation(NAVIGATION, { permissions: new Set(['users:read', 'audit:read']) });
    expect(labels(visible)).toEqual(['Dashboard', 'Users', 'Audit log', 'Settings']);
  });

  it('drops a group heading whose children are all hidden, and honours visible() and anyPermissions', () => {
    const sections: NavSection[] = [
      {
        items: [
          {
            label: 'Group',
            icon: 'x',
            children: [{ label: 'Child', route: '/c', icon: 'x', permissions: ['roles:read'] }],
          },
          { label: 'Any', route: '/a', icon: 'x', anyPermissions: ['users:read', 'roles:read'] },
          { label: 'Never', route: '/n', icon: 'x', visible: () => false },
        ],
      },
    ];
    expect(labels(filterNavigation(sections, { permissions: new Set(['users:read']) }))).toEqual(['Any']);
    expect(labels(filterNavigation(sections, { permissions: new Set(['roles:read']) }))).toEqual([
      'Group',
      'Any',
    ]);
  });
});

import { hasAllPermissions, hasAnyPermission } from '../../core/authorization/permissions';
import type { NavContext, NavItem, NavSection } from './navigation.config';

function isVisible(item: NavItem, context: NavContext): boolean {
  if (item.permissions && !hasAllPermissions(context.permissions, item.permissions)) return false;
  if (item.anyPermissions && !hasAnyPermission(context.permissions, item.anyPermissions)) return false;
  return item.visible ? item.visible(context) : true;
}

function filterItems(items: readonly NavItem[], context: NavContext): NavItem[] {
  const result: NavItem[] = [];
  for (const item of items) {
    if (!isVisible(item, context)) continue;
    if (item.children) {
      const children = filterItems(item.children, context);
      // A group without a page of its own disappears when none of its children are visible.
      if (children.length === 0 && !item.route) continue;
      result.push({ ...item, children });
    } else {
      result.push(item);
    }
  }
  return result;
}

/** The navigation the current user may see. Empty sections are dropped. */
export function filterNavigation(sections: readonly NavSection[], context: NavContext): NavSection[] {
  return sections
    .map((section) => ({ ...section, items: filterItems(section.items, context) }))
    .filter((section) => section.items.length > 0);
}

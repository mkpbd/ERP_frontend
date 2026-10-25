import { expect, test } from '@playwright/test';
import { mockApi, PASSWORDS, signIn } from './support/mock-api';

test.describe('permission-aware navigation', () => {
  test('an administrator sees every administration page', async ({ page }) => {
    await mockApi(page);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const label of ['Dashboard', 'Users', 'Roles', 'Permissions', 'Audit log', 'Settings']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }

    await nav.getByRole('link', { name: 'Roles' }).click();
    await expect(page.getByRole('heading', { name: 'Roles', level: 1 })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Roles' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Roles');
    await expect(page).toHaveTitle('Roles · ERP');
  });

  test('an auditor sees only what their permissions allow', async ({ page }) => {
    await mockApi(page);
    await signIn(page, 'auditor@example.com', PASSWORDS.user);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Audit log' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Roles' })).toHaveCount(0);

    await nav.getByRole('link', { name: 'Users' }).click();
    await expect(page.getByRole('row')).not.toHaveCount(0);
    // Read-only: no create button.
    await expect(page.getByTestId('create-user')).toHaveCount(0);
  });

  test('a user without roles is shown the 403 page for restricted URLs', async ({ page }) => {
    await mockApi(page);
    await signIn(page, 'member@example.com', PASSWORDS.user);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link')).toHaveCount(2);
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible();
    await page.goto('/roles');
    await expect(page.getByRole('heading', { name: "You don't have access to this page" })).toBeVisible();
  });

  test('unknown pages show a not-found state inside the shell', async ({ page }) => {
    await mockApi(page);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  test('mobile: the menu opens as an overlay and closes after navigating @mobile', async ({ page }) => {
    await mockApi(page);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
    const nav = page.getByRole('navigation', { name: 'Main' });
    const toggle = page.getByTestId('menu-toggle');

    await expect(nav).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await nav.getByRole('link', { name: 'Users' }).click();
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible();
    await expect(nav).toBeHidden();
  });
});

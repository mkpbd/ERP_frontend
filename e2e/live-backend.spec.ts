import { expect, test } from '@playwright/test';

/**
 * Read-only smoke test against a real backend (no API mocking). Opt-in, because it needs the NestJS API on
 * :3000 with development seed data. It only signs in and reads; it never creates or changes records.
 *
 *   E2E_LIVE=1 E2E_LIVE_EMAIL=admin@example.com E2E_LIVE_PASSWORD=... npx playwright test live-backend
 */
const email = process.env['E2E_LIVE_EMAIL'];
const password = process.env['E2E_LIVE_PASSWORD'];

test.skip(
  !process.env['E2E_LIVE'] || !email || !password,
  'Set E2E_LIVE, E2E_LIVE_EMAIL and E2E_LIVE_PASSWORD',
);

test('signs in against the real API, reads data, survives a reload and signs out', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Users' }).click();
  await expect(page.getByRole('table', { name: 'Users' })).toContainText(email!);

  // A full reload restores the session through the HttpOnly refresh cookie and the CSRF header.
  await page.reload();
  await expect(page.getByRole('table', { name: 'Users' })).toContainText(email!);

  await nav.getByRole('link', { name: 'Roles' }).click();
  await expect(page.getByRole('table', { name: 'Roles' })).toBeVisible();

  await page.getByTestId('user-menu').click();
  await page.getByTestId('sign-out').click();
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

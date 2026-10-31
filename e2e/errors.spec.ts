import { expect, test } from '@playwright/test';
import { mockApi, PASSWORDS, signIn } from './support/mock-api';

test('server failures show an error state with a working retry', async ({ page }) => {
  const api = await mockApi(page);
  await signIn(page, 'admin@example.com', PASSWORDS.admin);
  // Let the dashboard finish its own requests first, so that only the roles fail.
  await expect(page.getByText('auth.login')).toBeVisible();
  api.failWith = 500;

  // In-app navigation: a full reload would also fail to restore the session while the API is down.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Roles' }).click();
  await expect(page).toHaveURL(/\/roles$/);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Could not load roles');
  await expect(alert).toContainText('Ref: req-e2e');

  api.failWith = null;
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('table', { name: 'Roles' })).toContainText('auditor');
});

test('account settings tabs load profile and sessions', async ({ page }) => {
  await mockApi(page);
  await signIn(page, 'member@example.com', PASSWORDS.user);
  await page.goto('/settings');
  await expect(page.getByLabel('Display name')).toHaveValue('Mel Member');
  await page.getByRole('tab', { name: 'Sessions' }).click();
  await expect(page.getByText('Chrome on Windows')).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();
});

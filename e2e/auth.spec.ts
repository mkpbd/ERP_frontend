import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockApi, PASSWORDS, signIn } from './support/mock-api';

test.describe('authentication', () => {
  test('protected pages redirect to sign-in and return afterwards', async ({ page }) => {
    await mockApi(page);
    await page.goto('/users');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fusers$/);

    await page.getByLabel('Email or username').fill('admin@example.com');
    await page.getByLabel('Password', { exact: true }).fill(PASSWORDS.admin);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible();
  });

  test('shows validation errors and a generic message for wrong credentials', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Email or username is required.')).toBeVisible();

    await page.getByLabel('Email or username').fill('admin@example.com');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByTestId('login-error')).toHaveText(/Incorrect email\/username or password/);
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  });

  test('signs in with the keyboard only', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.getByLabel('Email or username').focus();
    await page.keyboard.type('admin@example.com');
    await page.keyboard.press('Tab');
    await page.keyboard.type(PASSWORDS.admin);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ada');
  });

  test('sign out ends the session', async ({ page }) => {
    const api = await mockApi(page);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
    await page.getByTestId('user-menu').click();
    await page.getByTestId('sign-out').click();
    await expect(page).toHaveURL(/\/login$/);
    expect(api.calls).toContain('POST /auth/logout');

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
  });

  test('an expired session sends the user back to sign-in with a notice', async ({ page }) => {
    const api = await mockApi(page);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
    // Let the dashboard finish its own requests first, so the next API call is the one that hits the 401.
    await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
    await expect(page.getByText('auth.login')).toBeVisible();
    api.sessionRevoked = true;

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/login\?reason=expired/);
    await expect(page.getByRole('status')).toContainText('Your session has expired');
  });

  test('forgot password always shows the same confirmation', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email').fill('someone@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toContainText('If an account exists');
  });

  test('sign-in page has no detectable accessibility violations', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

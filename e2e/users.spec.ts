import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockApi, PASSWORDS, signIn } from './support/mock-api';

test.describe('user management', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
    await page.goto('/users');
  });

  test('lists and searches users', async ({ page }) => {
    const table = page.getByRole('table', { name: 'Users' });
    await expect(table.getByRole('row')).toHaveCount(5); // header + 4 users
    await page.getByTestId('user-search').fill('audrey');
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table).toContainText('auditor@example.com');

    await page.getByTestId('user-search').fill('zzz-nobody');
    await expect(page.getByRole('heading', { name: 'No users match your filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(table.getByRole('row')).toHaveCount(5);
  });

  test('validates the create form on the client and maps server errors to fields', async ({ page }) => {
    await page.getByTestId('create-user').click();
    const dialog = page.getByRole('dialog', { name: 'New user' });
    await dialog.getByTestId('create-user-submit').click();
    await expect(dialog.getByText('Display name is required.')).toBeVisible();
    await expect(dialog.getByText('Email is required.')).toBeVisible();

    await dialog.getByLabel('Display name').fill('Second Admin');
    await dialog.getByLabel('Email').fill('admin@example.com');
    await dialog.getByLabel('Initial password').fill('short');
    await expect(dialog.getByText('Password must be at least 12 characters.')).toBeVisible();
    await dialog.getByLabel('Initial password').fill('a-long-enough-passphrase');
    await dialog.getByTestId('create-user-submit').click();
    await expect(dialog.getByText('A user with this email already exists')).toBeVisible();
  });

  test('creates a user and opens their page', async ({ page }) => {
    await page.getByTestId('create-user').click();
    const dialog = page.getByRole('dialog', { name: 'New user' });
    await dialog.getByLabel('Display name').fill('Nina New');
    await dialog.getByLabel('Email').fill('nina@example.com');
    await dialog.getByLabel('Initial password').fill('a-long-enough-passphrase');
    await dialog.getByTestId('create-user-submit').click();

    await expect(page.getByRole('heading', { name: 'Nina New', level: 1 })).toBeVisible();
    await expect(page.getByText('User created.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('User details');
  });

  test('deactivating asks for confirmation first', async ({ page }) => {
    await page.getByRole('link', { name: 'Manny Manager' }).click();
    await expect(page.getByRole('heading', { name: 'Manny Manager', level: 1 })).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Deactivate' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('Deactivate Manny Manager?');
    // Focus starts on Cancel, so a stray Enter cannot confirm.
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Active', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Deactivate' }).click();
    await page.getByTestId('confirm-button').click();
    await expect(page.getByText('User deactivated.')).toBeVisible();
    await expect(page.getByText('Deactivated', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible();
  });

  test('users page has no detectable accessibility violations', async ({ page }) => {
    await expect(page.getByRole('table', { name: 'Users' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

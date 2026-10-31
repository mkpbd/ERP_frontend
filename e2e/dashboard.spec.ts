import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, PASSWORDS, signIn } from './support/mock-api';
import { mockDashboard, type DashboardMock } from './support/mock-dashboard';

/** Where `SHOTS_DIR` is set, each step leaves a screenshot there (for a look at the screens). */
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env['SHOTS_DIR'];
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test.describe('dashboard figures', () => {
  let dashboard: DashboardMock;

  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    dashboard = await mockDashboard(page);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
  });

  test('shows each section with its figures against the days before, and a split on a click', async ({
    page,
  }) => {
    const figures = page.getByRole('region', { name: 'Figures' });
    await expect(figures.getByRole('heading', { name: 'Money' })).toBeVisible();
    await expect(page.getByTestId('head-money.received')).toContainText('৳ 13,87,764.5');
    await expect(page.getByTestId('head-money.received')).toContainText('16% up');
    await expect(page.getByTestId('head-pharmacy.sales')).toContainText('20% down');
    await expect(page.getByTestId('head-pharmacy.stock-value')).toContainText('now');
    await shot(page, 'dashboard-figures');

    await page.getByTestId('head-money.received').click();
    const dialog = page.getByRole('dialog', { name: 'Collected' });
    await expect(dialog.getByRole('table')).toContainText('৳ 13,87,764.5');
    await dialog.getByRole('radio', { name: 'Way paid' }).click();
    await expect(dialog.getByRole('table', { name: 'Collected by Way paid' })).toContainText('Card');
    await expect(dialog.getByRole('table')).toContainText('৳ 10,00,000');
    await shot(page, 'dashboard-split');
    expect(dashboard.asked).toContain('money.received by way');
    await dialog.getByRole('button', { name: 'Close' }).click();

    await figures.getByRole('radio', { name: 'Last 7 days' }).click();
    await expect.poll(() => dashboard.asked.at(-1)).toMatch(/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/);
    const [from, to] = dashboard.asked.at(-1)!.split('..');
    expect((Date.parse(to!) - Date.parse(from!)) / 86_400_000).toBe(6);
  });

  test('has no accessibility violations', async ({ page }) => {
    await expect(page.getByTestId('head-money.received')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

test('hides the figures from someone with no section to see', async ({ page }) => {
  await mockApi(page);
  await signIn(page, 'admin@example.com', PASSWORDS.admin);
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Figures' })).toHaveCount(0);
});

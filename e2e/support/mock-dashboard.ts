import type { Page } from '@playwright/test';

/**
 * Stand-in for `GET /dashboard` and its splits: a Money section and a Pharmacy section with figures against the days
 * before. Installed after `mockApi`, so it answers first; it records the days and splits asked for.
 */
export class DashboardMock {
  readonly asked: string[] = [];

  async install(page: Page): Promise<void> {
    await page.route('**/api/v1/dashboard**', async (route) => {
      const url = new URL(route.request().url());
      const from = url.searchParams.get('from') ?? '2026-10-31';
      const to = url.searchParams.get('to') ?? from;
      const json = (status: number, body: unknown) =>
        route.fulfill({
          status,
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(body),
        });
      const key = url.pathname.match(/\/dashboard\/heads\/([^/]+)$/)?.[1];
      if (!key) {
        this.asked.push(`${from}..${to}`);
        return json(200, {
          from,
          to,
          previousFrom: '2026-10-30',
          previousTo: '2026-10-30',
          sections: [
            {
              key: 'money',
              title: 'Money',
              heads: [
                {
                  key: 'money.received',
                  label: 'Collected',
                  unit: 'money',
                  hint: 'Taken in at the desks',
                  current: false,
                  value: 1387764.5,
                  previous: 1200000,
                  dimensions: [
                    { key: 'day', label: 'Day' },
                    { key: 'way', label: 'Way paid' },
                  ],
                },
              ],
            },
            {
              key: 'pharmacy',
              title: 'Pharmacy',
              heads: [
                {
                  key: 'pharmacy.sales',
                  label: 'Counter sales',
                  unit: 'count',
                  hint: null,
                  current: false,
                  value: 40,
                  previous: 50,
                  dimensions: [{ key: 'day', label: 'Day' }],
                },
                {
                  key: 'pharmacy.stock-value',
                  label: 'Stock at cost now',
                  unit: 'money',
                  hint: null,
                  current: true,
                  value: 250000,
                  previous: null,
                  dimensions: [{ key: 'outlet', label: 'Outlet' }],
                },
              ],
            },
          ],
        });
      }
      const by = url.searchParams.get('by') ?? 'day';
      this.asked.push(`${key} by ${by}`);
      const rows =
        by === 'way'
          ? [
              { label: 'Cash', value: 1000000 },
              { label: 'Card', value: 387764.5 },
            ]
          : by === 'outlet'
            ? [{ label: 'Outdoor pharmacy', value: 250000 }]
            : [{ label: from, value: key === 'pharmacy.sales' ? 40 : 1387764.5 }];
      return json(200, { key, label: key, unit: 'money', dimension: by, rows });
    });
  }
}

export async function mockDashboard(page: Page): Promise<DashboardMock> {
  const mock = new DashboardMock();
  await mock.install(page);
  return mock;
}

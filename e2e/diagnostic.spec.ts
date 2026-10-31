import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { type MockApi, mockApi, PASSWORDS, signIn } from './support/mock-api';
import { type DiagnosticMock, mockDiagnostic, toDay } from './support/mock-diagnostic';

/** Where `SHOTS_DIR` is set, each step leaves a screenshot there (for a look at the screens). */
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env['SHOTS_DIR'];
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

/** Makes the mock's member a collector (diag:collect only). */
function collector(api: MockApi): string {
  api.roles.push({
    id: 'collector-role',
    name: 'collector',
    description: 'Takes samples at homes',
    isSystem: false,
    permissions: ['diag:collect'],
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  });
  const member = api.users.find((user) => user.email === 'member@example.com')!;
  member.roleIds = ['collector-role'];
  return member.id;
}

async function pick(page: Page, testId: string, text: string, option: string | RegExp): Promise<void> {
  await page.getByTestId(testId).fill(text);
  await page.getByRole('option', { name: option }).click();
}

test.describe('diagnostic bookings', () => {
  let api: MockApi;
  let diagnostic: DiagnosticMock;

  test.beforeEach(async ({ page }) => {
    api = await mockApi(page);
    diagnostic = await mockDiagnostic(page, api);
  });

  test('books tests in a window with a place and bills them on the day', async ({ page }) => {
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
    await page.goto('/diagnostic/appointments');
    await expect(page.getByRole('heading', { name: 'Test appointments', level: 1 })).toBeVisible();
    await expect(page.getByTestId('window-Morning lab')).toContainText('0 of 2 booked');

    await page.getByTestId('book-tests').click();
    const dialog = page.getByRole('dialog', { name: 'Book tests' });
    await pick(page, 'booking-patient', 'Abdul', /Abdul Karim · UHID 260101/);
    await dialog.getByTestId('booking-department').click();
    await page.getByRole('option', { name: 'Pathology' }).click();
    await dialog.getByRole('radio', { name: /Morning lab/ }).check();
    await pick(page, 'booking-test', 'blood', /Complete blood count/);
    await expect(dialog.getByTestId('booking-tests-total')).toHaveText('৳ 400.00');
    await shot(page, 'diagnostic-book-tests');
    await dialog.getByTestId('booking-submit').click();
    await expect(page.getByText('Booked TA-2026-00001, serial 1.')).toBeVisible();
    expect(diagnostic.reports.map((report) => report.key)).toContain('hospital.test-appointment-slip');

    const table = page.getByRole('table', { name: 'Test appointments' });
    const row = table.getByRole('row', { name: /Abdul Karim/ });
    await expect(row).toContainText('Complete blood count');
    await expect(page.getByTestId('window-Morning lab')).toContainText('1 of 2 booked');
    await expect(page.getByTestId('appointment-summary')).toContainText('1 booked');

    await row.getByRole('button', { name: 'Bill TA-2026-00001' }).click();
    const bill = page.getByRole('dialog', { name: 'Bill TA-2026-00001' });
    await expect(bill.getByTestId('bill-total')).toHaveText('৳ 400.00');
    await bill.getByTestId('bill-submit').click();
    await expect(page.getByText('Billed on DB-2026-00001.')).toBeVisible();
    await expect(row).toContainText('Billed');
    await expect(row).toContainText('DB-2026-00001');
    expect(diagnostic.bills[0]).toMatchObject({
      testAppointmentId: diagnostic.appointments[0]!.id,
      payment: { amount: 400, method: 'cash' },
    });
    expect(diagnostic.reports.map((report) => report.key)).toContain('hospital.diagnostic-receipt');
    await shot(page, 'diagnostic-appointments');
  });

  test('books a home visit, sends a collector, records it and bills the visit', async ({ page }) => {
    const memberId = collector(api);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
    await page.goto('/diagnostic/home-collections');
    await page.getByTestId('book-collection').click();
    const dialog = page.getByRole('dialog', { name: 'Book a home collection' });
    await dialog.getByRole('radio', { name: 'Not registered yet' }).click();
    await dialog.getByTestId('booking-name').fill('Nasir Uddin');
    await dialog.getByTestId('booking-mobile').fill('01911000000');
    await dialog.getByTestId('collection-area').click();
    await page.getByRole('option', { name: 'Kolatoli' }).click();
    await dialog.getByTestId('collection-window').click();
    await page.getByRole('option', { name: '08:00 AM - 10:00 AM' }).click();
    await dialog.getByTestId('collection-address').fill('House 12, Road 3');
    await pick(page, 'booking-test', 'blood', /Complete blood count/);
    await expect(dialog.getByText('৳ 600.00 short')).toBeVisible();
    await pick(page, 'booking-test', 'lipid', /Lipid profile/);
    await expect(dialog.getByText('৳ 600.00 short')).toBeHidden();
    await expect(dialog.getByLabel('What the visit costs')).toContainText('৳ 1,500.00');
    await shot(page, 'diagnostic-book-collection');
    await dialog.getByTestId('collection-submit').click();
    await expect(page.getByText('Booked HC-2026-00001.')).toBeVisible();

    const row = page
      .getByRole('table', { name: 'Home collections' })
      .getByRole('row', { name: /HC-2026-00001/ });
    await row.getByRole('button', { name: 'Collector for HC-2026-00001' }).click();
    const assign = page.getByRole('dialog', { name: 'Collector for HC-2026-00001' });
    await assign.getByTestId('collector-select').click();
    await page.getByRole('option', { name: 'Mel Member' }).click();
    await assign.getByTestId('collector-submit').click();
    await expect(page.getByText('Collector sent.')).toBeVisible();
    await expect(row).toContainText('Collector given');
    expect(diagnostic.collections[0]).toMatchObject({ collectorId: memberId });

    await row.getByRole('button', { name: 'Collected HC-2026-00001' }).click();
    const collected = page.getByRole('dialog', { name: 'Samples of HC-2026-00001 taken?' });
    await collected.getByLabel('Note (tubes, fasting …)').fill('Two tubes');
    await collected.getByRole('button', { name: 'Collected' }).click();
    await expect(page.getByText('Recorded as collected.')).toBeVisible();
    await expect(row).toContainText('Collected');

    await row.getByRole('button', { name: 'Bill HC-2026-00001' }).click();
    const bill = page.getByRole('dialog', { name: 'Bill HC-2026-00001' });
    await expect(bill).toContainText('not registered: bill the registered patient');
    await expect(bill.getByTestId('bill-total')).toHaveText('৳ 1,500.00');
    await pick(page, 'booking-patient', 'Abdul', /Abdul Karim/);
    await bill.getByTestId('bill-paid').fill('1000');
    await expect(bill).toContainText('Due after this: ৳ 500.00');
    await bill.getByTestId('bill-submit').click();
    await expect(page.getByText('Billed on DB-2026-00001.')).toBeVisible();
    await expect(row).toContainText('DB-2026-00001');
    await expect(row).toContainText('৳ 500.00');
    expect(diagnostic.bills[0]).toMatchObject({
      homeCollectionId: diagnostic.collections[0]!.id,
      payment: { amount: 1000 },
    });

    await page.getByTestId('run-sheet').click();
    await expect
      .poll(
        () => diagnostic.reports.find((report) => report.key === 'hospital.home-collection-sheet')?.params,
      )
      .toEqual({ date: toDay(new Date()) });
    await shot(page, 'diagnostic-home-collections');
  });

  test('keeps the windows and areas, and names the service a visit is billed as', async ({ page }) => {
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
    await page.goto('/diagnostic/setup');
    await expect(page.getByRole('heading', { name: 'Booking setup', level: 1 })).toBeVisible();
    const windows = page.getByRole('table', { name: 'Test appointment windows' });
    await expect(windows.getByRole('row', { name: /Morning lab/ })).toContainText('Pathology');
    await expect(windows.getByRole('row', { name: /All day/ })).toContainText('Any department');

    await page.getByRole('button', { name: 'New window' }).click();
    const form = page.getByRole('dialog', { name: 'New window' });
    // The dialog puts the cursor in its first field once open; typing earlier could be lost.
    await expect(form.getByLabel('Name')).toBeFocused();
    await form.getByLabel('Name').fill('Evening imaging');
    await form.getByLabel('Starts (HH:MM)').fill('17:00');
    await form.getByLabel('Ends (HH:MM)').fill('20:00');
    await form.getByLabel('Places a day').fill('5');
    await expect(form.getByLabel('Places a day')).toHaveValue('5');
    await form.getByRole('combobox', { name: 'Department' }).click();
    await page.getByRole('option', { name: 'Radiology' }).click();
    await form.getByRole('button', { name: 'Add' }).click();
    await expect(windows.getByRole('row', { name: /Evening imaging/ })).toContainText('Radiology');
    expect(diagnostic.records['test-appointment-windows']!.at(-1)).toMatchObject({
      capacity: 5,
      departmentId: diagnostic.departments[1]!.id,
      displayOrder: 0,
      endTime: '20:00',
    });

    await page.getByRole('tab', { name: 'Collection areas' }).click();
    const areas = page.getByRole('table', { name: 'Home collection areas' });
    await expect(areas.getByRole('row', { name: /Kolatoli/ })).toContainText('Every day');
    await page.getByRole('button', { name: 'New area' }).click();
    const area = page.getByRole('dialog', { name: 'New area' });
    await expect(area.getByLabel('Area')).toBeFocused();
    await area.getByLabel('Area').fill('Sugandha');
    await area.getByLabel('Visit charge (৳)').fill('150');
    await area.getByRole('button', { name: 'Sat' }).click();
    await area.getByRole('button', { name: 'Sun' }).click();
    await shot(page, 'diagnostic-area');
    await area.getByRole('button', { name: 'Add' }).click();
    await expect(areas.getByRole('row', { name: /Sugandha/ })).toContainText('Sat, Sun');
    expect(diagnostic.records['home-collection-areas']!.at(-1)).toMatchObject({
      charge: 150,
      minimumOrder: 0,
      days: ['saturday', 'sunday'],
    });

    await page.getByRole('tab', { name: 'Visit charge' }).click();
    await page.getByTestId('home-service').click();
    await page.getByRole('option', { name: 'Home collection charge' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    expect(diagnostic.policy).toEqual({
      counterDiscountPercent: 10,
      defaultReferralPercent: 0,
      homeCollectionTestId: diagnostic.tests[3]!.id,
    });
  });

  test('shows a collector only the visits given to them', async ({ page }) => {
    const memberId = collector(api);
    diagnostic.seed(memberId);
    await signIn(page, 'member@example.com', PASSWORDS.user);
    await page.goto('/diagnostic/home-collections');
    await expect(page.getByText('The visits given to you.')).toBeVisible();
    const row = page
      .getByRole('table', { name: 'Home collections' })
      .getByRole('row', { name: /Nasir Uddin/ });
    await expect(row).toContainText('Near the mosque');
    await expect(row.getByRole('button', { name: 'Collected HC-2026-00009' })).toBeVisible();
    await expect(row.getByRole('button', { name: /^Bill/ })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Area' })).toHaveCount(0);
    expect(
      api.calls.some((call) => call.includes('/home-collections?') && call.includes('collectorId=me')),
    ).toBe(true);
    await expect(page.getByRole('link', { name: 'Test appointments' })).toHaveCount(0);
  });

  for (const [name, path] of [
    ['appointments', '/diagnostic/appointments'],
    ['home collections', '/diagnostic/home-collections'],
    ['setup', '/diagnostic/setup'],
  ] as const) {
    test(`the ${name} page has no accessibility violations`, async ({ page }) => {
      diagnostic.seed();
      await signIn(page, 'admin@example.com', PASSWORDS.admin);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, PASSWORDS, signIn } from './support/mock-api';
import { mockNursing, type NursingMock } from './support/mock-nursing';

/** Where `SHOTS_DIR` is set, each step leaves a screenshot there (for a look at the screens). */
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env['SHOTS_DIR'];
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

const STAY = '00000000-0000-4000-c000-000000000001';
const LEFT = '00000000-0000-4000-c000-000000000002';

test.describe('nursing', () => {
  let nursing: NursingMock;

  test.beforeEach(async ({ page }) => {
    const api = await mockApi(page);
    nursing = await mockNursing(page, api);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
  });

  test('records a round from the board and names what to tell the doctor', async ({ page }) => {
    await page.goto('/nursing');
    await expect(page.getByRole('heading', { name: 'Observation rounds', level: 1 })).toBeVisible();
    const board = page.getByRole('table', { name: 'Observation board' });
    await expect(board).not.toContainText('Abdul Karim');
    const row = board.getByRole('row', { name: /Rahima Begum/ });
    await expect(row).toContainText('Done');
    await expect(row).toContainText('Due');

    await row.getByRole('button', { name: 'Record' }).click();
    const dialog = page.getByRole('dialog', { name: 'Observation · Rahima Begum' });
    // The dialog puts the cursor in the first reading once open; typing earlier could land there.
    await expect(dialog.getByTestId('obs-temp')).toBeFocused();
    await dialog.getByTestId('obs-temp').fill('101.2');
    await dialog.getByTestId('obs-pulse').fill('112');
    await dialog.getByTestId('obs-spo2').fill('97');
    await dialog.getByTestId('obs-systolic').fill('118');
    await dialog.getByTestId('obs-diastolic').fill('76');
    await shot(page, 'nursing-observation');
    await dialog.getByTestId('obs-submit').click();
    await expect(page.getByText('Recorded. Tell the doctor: Fever, Fast pulse.')).toBeVisible();
    await expect(row).not.toContainText('Due');
    await expect(row).toContainText('Fever');
    expect(nursing.observations.at(-1)!.values).toMatchObject({ temperatureF: 101.2, pulse: 112, spo2: 97 });
    await shot(page, 'nursing-board');
  });

  test('strikes a wrong reading, charts a medicine and nursing care', async ({ page }) => {
    await page.goto(`/nursing/admissions/${STAY}`);
    await expect(page.getByRole('heading', { name: 'Rahima Begum', level: 1 })).toBeVisible();

    // The sheet: strike the morning reading through.
    await expect(page.getByRole('table', { name: 'Observation sheet' })).toContainText('98.6');
    await page.getByRole('button', { name: /^Strike the reading at/ }).click();
    const strike = page.getByRole('dialog', { name: 'Strike the reading through?' });
    await strike.getByLabel('Why it was wrong').fill('Another patient');
    await strike.getByRole('button', { name: 'Strike through' }).click();
    await expect(page.getByText('Struck through.')).toBeVisible();
    expect(nursing.observations[0]!.struckReason).toBe('Another patient');
    await shot(page, 'nursing-sheet');

    // Medicines: order, give the morning dose, miss the evening one, hold.
    await page.getByRole('tab', { name: 'Medicines' }).click();
    await expect(page.getByText('No medicine ordered for this day.')).toBeVisible();
    await page.getByTestId('order-medicine').click();
    const order = page.getByRole('dialog', { name: 'Order a medicine' });
    await expect(order.getByTestId('order-product')).toBeFocused();
    await order.getByTestId('order-product').fill('napa');
    await page.getByRole('option', { name: /Napa 500/ }).click();
    await order.getByTestId('order-dose').fill('1 tablet');
    await order.getByTestId('order-times').fill('08:00, 20:00');
    await shot(page, 'nursing-order');
    await order.getByTestId('order-submit').click();
    await expect(page.getByText('Medicine ordered.')).toBeVisible();
    const chart = page.getByRole('list', { name: 'Medication chart' });
    await expect(chart).toContainText('Napa 500');

    await chart
      .getByRole('button', { name: /^Given Napa 500 at/ })
      .first()
      .click();
    await expect(page.getByText('Marked given.')).toBeVisible();
    await chart.getByRole('button', { name: /^Missed Napa 500 at/ }).click();
    const missed = page.getByRole('dialog', { name: 'Napa 500: missed' });
    await missed.getByLabel('Why').fill('Asleep');
    await missed.getByRole('button', { name: 'Missed' }).click();
    await expect(chart).toContainText('missed: Asleep');
    expect(nursing.orders[0]!.records.map((row) => row.outcome)).toEqual(['given', 'missed']);

    await chart.getByRole('button', { name: 'Change Napa 500' }).click();
    await page.getByRole('menuitem', { name: 'Hold' }).click();
    const hold = page.getByRole('dialog', { name: 'Hold Napa 500?' });
    await hold.getByLabel('Reason').fill('Nil by mouth');
    await hold.getByRole('button', { name: 'Hold' }).click();
    await expect(chart).toContainText('Held');
    await shot(page, 'nursing-medicines');
    await page.getByRole('button', { name: "Print the day's chart" }).first().click();
    await expect.poll(() => nursing.reports).toContain('clinical.medication-chart');

    // Nursing care: order a dressing, mark it done.
    await page.getByRole('tab', { name: 'Nursing care' }).click();
    await page.getByTestId('order-care').click();
    const care = page.getByRole('dialog', { name: 'Order nursing care' });
    await expect(care.getByTestId('order-name')).toBeFocused();
    await care.getByTestId('order-name').fill('Dressing change');
    await care.getByTestId('order-times').fill('10:00');
    await care.getByTestId('order-submit').click();
    await expect(page.getByText('Care ordered.')).toBeVisible();
    const careChart = page.getByRole('list', { name: 'Care chart' });
    await careChart.getByRole('button', { name: /^Done Dressing change at/ }).click();
    await expect(page.getByText('Marked done.')).toBeVisible();
    await expect(careChart).toContainText('done');
    await shot(page, 'nursing-care');
  });

  test('keeps a discharged stay read only, and says when there is no such stay', async ({ page }) => {
    await page.goto(`/nursing/admissions/${LEFT}`);
    await expect(page.getByText('The patient has left: the records are read only.')).toBeVisible();
    await expect(page.getByTestId('record-observation')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Medicines' }).click();
    await expect(page.getByTestId('order-medicine')).toHaveCount(0);

    await page.goto('/nursing/admissions/00000000-0000-4000-c000-000000000099');
    await expect(page.getByText('Admission not found')).toBeVisible();
  });

  test('sets the rounds', async ({ page }) => {
    await page.goto('/nursing/rounds');
    await page.getByRole('button', { name: 'New round' }).click();
    const dialog = page.getByRole('dialog', { name: 'New round' });
    await dialog.getByLabel('Name').fill('Night');
    await dialog.getByLabel('From (HH:MM)').fill('22:00');
    await dialog.getByLabel(/^To \(HH:MM/).fill('06:00');
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('table', { name: 'Observation rounds' })).toContainText('Night');
    expect(nursing.rounds.at(-1)).toMatchObject({ name: 'Night', startTime: '22:00', endTime: '06:00' });
    await shot(page, 'nursing-rounds');
  });

  for (const [name, path] of [
    ['board', '/nursing'],
    ['stay', `/nursing/admissions/${STAY}`],
  ] as const) {
    test(`the ${name} has no accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});

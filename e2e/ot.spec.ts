import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, PASSWORDS, signIn } from './support/mock-api';
import { mockOt, type OtMock } from './support/mock-ot';

/** Where `SHOTS_DIR` is set, each step leaves a screenshot there (for a look at the screens). */
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env['SHOTS_DIR'];
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function pick(page: Page, testId: string, text: string, option: RegExp): Promise<void> {
  await page.getByTestId(testId).fill(text);
  await page.getByRole('option', { name: option }).click();
}

test.describe('operation theatre', () => {
  let ot: OtMock;

  test.beforeEach(async ({ page }) => {
    const api = await mockApi(page);
    ot = await mockOt(page, api);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
  });

  test('takes an operation from request to a signed note, with its charges', async ({ page }) => {
    await page.goto('/ot');
    const room1 = page.getByRole('region', { name: 'OT-1' });
    await expect(room1).toContainText('Appendectomy');
    await expect(page.getByRole('region', { name: 'OT-2' })).toContainText('Free all day');
    await shot(page, 'ot-board');

    // Request: an admitted patient, the operation and the surgeon.
    await page.getByTestId('ot-request').click();
    const request = page.getByRole('dialog', { name: 'Request an operation' });
    await request.getByTestId('ot-request-submit').click();
    await expect(request.getByRole('alert')).toContainText('Fill in the patient');
    await pick(page, 'ot-admission', 'rahima', /Rahima Begum/);
    await pick(page, 'ot-operation', 'caes', /Caesarean section/);
    await pick(page, 'ot-surgeon', 'nusrat', /Nusrat Jahan/);
    await shot(page, 'ot-request');
    await request.getByTestId('ot-request-submit').click();

    await expect(page.getByRole('heading', { name: 'Caesarean section', level: 1 })).toBeVisible();
    await expect(page.getByText('Operation requested.')).toBeVisible();
    await expect(page.getByText('Requested', { exact: true })).toBeVisible();

    // Schedule: OT-1 is taken at that time, OT-2 is free.
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    const schedule = page.getByRole('dialog', { name: /Schedule OT-2026/ });
    await schedule.getByTestId('ot-room').click();
    await page.getByRole('option', { name: 'OT-1 · 3rd floor' }).click();
    await schedule.getByLabel('From', { exact: true }).fill('09:30');
    await schedule.getByLabel('To', { exact: true }).fill('10:00');
    await schedule.getByTestId('ot-schedule-submit').click();
    await expect(schedule.getByRole('alert')).toContainText('taken by OT-2026-00001');
    await schedule.getByTestId('ot-room').click();
    await page.getByRole('option', { name: 'OT-2 · 3rd floor' }).click();
    await schedule.getByTestId('ot-schedule-submit').click();
    await expect(page.getByText('Operation scheduled.')).toBeVisible();
    await expect(page.getByText('Scheduled', { exact: true })).toBeVisible();

    // Start, write the note, charge, finish and sign.
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Start the operation?' })
      .getByRole('button', { name: 'Start' })
      .click();
    await expect(page.getByText('In progress', { exact: true })).toBeVisible();

    await page.getByLabel('Procedure done').fill('Lower segment caesarean section.\nBaby delivered alive.');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(page.getByText('Operation note saved.')).toBeVisible();

    await page.getByRole('button', { name: 'Add charge' }).click();
    const charge = page.getByRole('dialog', { name: /Charge for/ });
    await pick(page, 'ot-charge-service', 'surgeon', /Surgeon fee/);
    await charge.getByTestId('ot-charge-submit').click();
    await expect(charge.getByRole('alert')).toContainText("doctor's share");
    await charge.getByLabel('Doctor').fill('nusrat');
    await page.getByRole('option', { name: /Nusrat Jahan/ }).click();
    await charge.getByTestId('ot-charge-submit').click();
    await expect(page.getByText('Charge added to the stay.')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Charges' })).toContainText('Surgeon fee (major)');

    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Finish the operation?' })
      .getByRole('button', { name: 'Finish' })
      .click();
    await expect(page.getByText('Done', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Sign', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Sign' }).click();
    await expect(page.getByText(/Signed by Dr\. Nusrat Jahan/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save note' })).toHaveCount(0);
    await shot(page, 'ot-case');

    // Prints go to the report endpoint.
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Print operation note' }).click();
    await expect.poll(() => ot.reports).toContain('hospital.ot-note');
  });

  test('cancels an operation with a reason', async ({ page }) => {
    await page.goto(`/ot/cases/${ot.cases[0]!.id}`);
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Cancel operation' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cancel the operation?' });
    await dialog.getByLabel('Reason').fill('Patient not fit for surgery');
    await dialog.getByRole('button', { name: 'Cancel operation' }).click();
    await expect(page.getByText('Cancelled: Patient not fit for surgery')).toBeVisible();
  });

  test('lists operations and manages the OT masters', async ({ page }) => {
    await page.goto('/ot/cases');
    const table = page.getByRole('table', { name: 'Operations' });
    await expect(table).toContainText('Abdul Karim');
    await shot(page, 'ot-cases');

    await page.goto('/ot/setup');
    await page.getByRole('button', { name: 'New OT room' }).click();
    const dialog = page.getByRole('dialog', { name: 'New OT room' });
    await dialog.getByLabel('Name').fill('OT-3');
    await dialog.getByLabel('Floor').fill('4th floor');
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('OT room added.')).toBeVisible();
    await expect(page.getByRole('table', { name: 'OT rooms' })).toContainText('OT-3');
    await shot(page, 'ot-setup');
  });

  test('the OT board has no accessibility violations', async ({ page }) => {
    await page.goto('/ot');
    await expect(page.getByRole('region', { name: 'OT-1' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

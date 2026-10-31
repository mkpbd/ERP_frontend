import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, PASSWORDS, signIn } from './support/mock-api';
import { mockIpd, type IpdMock } from './support/mock-ipd';

/** Where `SHOTS_DIR` is set, each step leaves a screenshot there (for a look at the screens). */
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env['SHOTS_DIR'];
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function pick(page: Page, testId: string, text: string, option: RegExp): Promise<void> {
  await page.getByTestId(testId).fill(text);
  await page.getByRole('option', { name: option }).click();
}

test.describe('inpatients', () => {
  let ipd: IpdMock;

  test.beforeEach(async ({ page }) => {
    const api = await mockApi(page);
    ipd = await mockIpd(page, api);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
  });

  async function admit(page: Page): Promise<void> {
    await page.goto('/ipd');
    await page.getByTestId('admit').click();
    const dialog = page.getByRole('dialog', { name: 'Admit a patient' });
    await dialog.getByTestId('admit-submit').click();
    await expect(dialog.getByRole('alert')).toContainText('Choose the patient');
    await pick(page, 'admit-patient', 'rahima', /Rahima Begum/);
    await dialog.getByTestId('admit-bed').click();
    await page.getByRole('option', { name: /W-1/ }).click();
    await pick(page, 'admit-consultant', 'nusrat', /Nusrat Jahan/);
    await dialog.getByLabel('Advance (optional)').fill('1000');
    await shot(page, 'ipd-admit');
    await dialog.getByTestId('admit-submit').click();
    await expect(page.getByRole('heading', { name: 'Rahima Begum', level: 1 })).toBeVisible();
  }

  test('admits a patient, corrects the admission, bills, discharges and reopens', async ({ page }) => {
    await admit(page);
    await expect(page.getByText('Admitted as IP-2026-00001.')).toBeVisible();

    // Correct: emergency, referred, the company pays.
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Correct the admission' }).click();
    const correct = page.getByRole('dialog', { name: 'Correct the admission' });
    await correct.getByLabel('Kind').click();
    await page.getByRole('option', { name: 'Emergency' }).click();
    await correct.getByTestId('correct-payer').click();
    await page.getByRole('option', { name: 'Acme Ltd' }).click();
    await correct.getByTestId('correct-submit').click();
    await expect(page.getByText('Admission corrected.')).toBeVisible();
    await expect(page.getByText('Acme Ltd')).toBeVisible();

    // The account: a charge, then the final bill.
    await page.getByRole('tab', { name: 'Account' }).click();
    await page.getByRole('button', { name: 'Charge', exact: true }).click();
    await pick(page, 'stay-service', 'dress', /Dressing/);
    await page.getByTestId('stay-charge-submit').click();
    await expect(page.getByRole('table', { name: 'Charges' })).toContainText('Dressing');
    await page.getByRole('button', { name: 'Make final bill' }).click();
    await page.getByTestId('bill-submit').click();
    await expect(page.getByText(/Final bill IB-2026-00001 made/)).toBeVisible();
    await shot(page, 'ipd-account');

    // Discharged, then a manager reopens it (nothing was paid).
    await page.getByRole('button', { name: 'Discharge', exact: true }).click();
    await page.getByTestId('discharge-submit').click();
    await expect(page.getByText('Patient discharged.')).toBeVisible();
    await expect(page.getByText('Discharged', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reopen' }).click();
    const reopen = page.getByRole('dialog', { name: 'Reopen the admission?' });
    await reopen.getByLabel('Reason').fill('Wrong patient discharged');
    await reopen.getByRole('button', { name: 'Reopen' }).click();
    await expect(page.getByText('Admission reopened.')).toBeVisible();
    await expect(page.getByText('Admitted', { exact: true })).toBeVisible();
    expect(ipd.stays[0]).toMatchObject({
      status: 'admitted',
      bill: null,
      corporateClientId: ipd.clients[0]!.id,
    });
  });

  test('issues visitor passes up to the limit and takes one back', async ({ page }) => {
    await admit(page);
    await page.getByRole('tab', { name: 'Visitor passes' }).click();
    for (const name of ['Abdul Rahim', 'Fatema Begum', 'Jamal Uddin']) {
      await page.getByTestId('issue-pass').click();
      const dialog = page.getByRole('dialog', { name: 'Visitor pass' });
      await dialog.getByTestId('pass-name').fill(name);
      await dialog.getByTestId('pass-submit').click();
      if (name === 'Jamal Uddin') {
        await expect(dialog.getByRole('alert')).toContainText('2 passes are in force');
        await dialog.getByRole('button', { name: 'Back' }).click();
      } else {
        await expect(page.getByRole('list', { name: 'Visitor passes' })).toContainText(name);
      }
    }
    await expect.poll(() => ipd.reports.filter((key) => key === 'hospital.visitor-pass').length).toBe(2);
    await page.getByRole('button', { name: 'Handed back' }).first().click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Handed back' }).click();
    // One pass left in force: one 'Handed back' button, the other pass marked as handed back.
    await expect(
      page.getByRole('list', { name: 'Visitor passes' }).getByRole('button', { name: 'Handed back' }),
    ).toHaveCount(1);
    expect(ipd.stays[0]!.passes.map((pass) => pass.status).sort()).toEqual(['active', 'returned']);
    await shot(page, 'ipd-passes');
  });

  test('shows the bed board and the admissions, and takes a bed out of order', async ({ page }) => {
    await admit(page);
    await page.goto('/ipd/beds');
    const general = page.getByRole('region', { name: 'General ward' });
    await expect(general).toContainText('Rahima Begum');
    await page.getByRole('button', { name: 'Bed W-2 status' }).click();
    await page.getByRole('menuitem', { name: 'Out of order' }).click();
    await expect(page.getByText('Bed W-2: out of order.')).toBeVisible();
    await shot(page, 'ipd-beds');
    await page.goto('/ipd');
    await expect(page.getByRole('table', { name: 'Admissions' })).toContainText('IP-2026-00001');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

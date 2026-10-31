import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, PASSWORDS, signIn } from './support/mock-api';
import { mockLab, type LabMock } from './support/mock-lab';

/** Where `SHOTS_DIR` is set, each step leaves a screenshot there (for a look at the screens). */
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env['SHOTS_DIR'];
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function pick(page: Page, testId: string, text: string, option: RegExp): Promise<void> {
  await page.getByTestId(testId).fill(text);
  await page.getByRole('option', { name: option }).click();
}

test.describe('laboratory', () => {
  let lab: LabMock;

  test.beforeEach(async ({ page }) => {
    const api = await mockApi(page);
    lab = await mockLab(page, api);
    await signIn(page, 'admin@example.com', PASSWORDS.admin);
  });

  async function collectAndTakeIn(page: Page): Promise<void> {
    await page.goto('/lab');
    await page.getByRole('button', { name: 'Collect sample' }).click();
    const dialog = page.getByRole('dialog', { name: 'Collect a sample' });
    await dialog.getByTestId('collect-bill').fill('db-2026-00999');
    await dialog.getByRole('button', { name: 'Find' }).click();
    await expect(dialog.getByRole('alert')).toContainText('No bill has this number.');
    await dialog.getByTestId('collect-bill').fill('db-2026-00412');
    await dialog.getByRole('button', { name: 'Find' }).click();
    await expect(dialog.getByRole('region', { name: 'Pathology' })).toContainText(
      'Urine culture and sensitivity',
    );
    await shot(page, 'lab-collect');
    await dialog.getByRole('button', { name: 'Collect 3' }).click();

    await expect(page.getByRole('heading', { name: 'Sample LB-261031-0001', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Take in' }).click();
    await expect(page.getByText('In the lab', { exact: true })).toBeVisible();
  }

  test('enters a culture with its antibiogram, verifies it and prints the report', async ({ page }) => {
    await collectAndTakeIn(page);
    await page.getByRole('link', { name: 'Urine culture and sensitivity' }).click();
    await expect(
      page.getByRole('heading', { name: 'Urine culture and sensitivity', level: 1 }),
    ).toBeVisible();

    await page.getByLabel('Pus cells').fill('8-10 /HPF');
    await page.getByTestId('culture-save').click();
    await expect(page.getByRole('alert')).toContainText('Name the organism');

    await pick(page, 'culture-organism-1', 'coli', /Escherichia coli/);
    await pick(page, 'culture-organism-2', 'kleb', /Klebsiella pneumoniae/);
    await page.getByRole('button', { name: 'Add all antibiotics' }).click();
    const grid = page.getByRole('table', { name: 'Antibiogram' });
    // Meropenem (S, S), Ciprofloxacin (S, R): click to step, or type.
    await grid.getByRole('button', { name: 'Meropenem against Escherichia coli: blank' }).click();
    await grid.getByRole('button', { name: 'Meropenem against Klebsiella pneumoniae: blank' }).click();
    await grid.getByRole('button', { name: 'Ciprofloxacin against Escherichia coli: blank' }).click();
    await grid.getByRole('button', { name: 'Ciprofloxacin against Klebsiella pneumoniae: blank' }).press('r');
    await shot(page, 'lab-culture-entry');
    await page.getByTestId('culture-save').click();
    await expect(page.getByText('Result saved.')).toBeVisible();
    await expect(page.getByText('To verify', { exact: true })).toBeVisible();

    const entered = lab.results.find((row) => row.form === 'culture')!;
    expect(entered.culture).toMatchObject({
      pusCells: '8-10 /HPF',
      organismIds: [lab.masters['organisms']![0]!['id'], lab.masters['organisms']![1]!['id']],
      sensitivity: [
        { antibiotic: 'Meropenem', results: ['S', 'S'] },
        { antibiotic: 'Ciprofloxacin', results: ['S', 'R'] },
      ],
    });

    await page.getByRole('button', { name: 'Verify' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByText('Verified', { exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Antibiogram' })).toContainText('Ciprofloxacin');
    await shot(page, 'lab-culture-verified');

    await page.getByRole('link', { name: /Sample LB-261031-0001/ }).click();
    await page.getByRole('button', { name: 'Print report' }).click();
    await expect.poll(() => lab.reports).toContain('laboratory.lab-report');
    await page.getByRole('button', { name: 'Hand over' }).click();
    const handOver = page.getByRole('dialog', { name: 'Hand over the reports?' });
    await handOver.getByLabel('Collected by').fill('Patient');
    await handOver.getByRole('button', { name: 'Hand over' }).click();
    await expect(page.getByRole('table', { name: 'Tests of the sample' })).toContainText('Patient');
  });

  test('writes a histopathology report from a template', async ({ page }) => {
    await collectAndTakeIn(page);
    await page.getByRole('link', { name: 'Histopathology (small biopsy)' }).click();
    await page.getByTestId('text-template').click();
    await page.getByRole('option', { name: /Benign skin lesion/ }).click();
    await expect(page.getByTestId('text-narrative')).toHaveValue(/No malignancy seen\./);
    await page.getByTestId('text-narrative').press('End');
    await page.getByTestId('text-narrative').pressSequentially('\n\nDIAGNOSIS:\nSeborrhoeic keratosis.');
    await shot(page, 'lab-text-entry');
    await page.getByTestId('text-save').click();
    await expect(page.getByText('Result saved.')).toBeVisible();
    expect(lab.results.find((row) => row.form === 'descriptive')?.narrative).toContain(
      'Seborrhoeic keratosis.',
    );
  });

  test('enters values, and lists the worklist by status', async ({ page }) => {
    await collectAndTakeIn(page);
    await page.getByRole('link', { name: 'Haemoglobin' }).click();
    await page.getByRole('table', { name: 'Values' }).getByLabel('Haemoglobin').fill('10.4');
    await page.getByRole('button', { name: 'Save values' }).click();
    await expect(page.getByText('Result saved.')).toBeVisible();

    await page.goto('/lab');
    const worklist = page.getByRole('table', { name: 'Lab worklist' });
    await expect(worklist.getByRole('row')).toHaveCount(3); // header + culture and biopsy to enter
    await page.getByRole('radio', { name: 'To verify' }).click();
    await expect(worklist).toContainText('Haemoglobin');
    await shot(page, 'lab-worklist');
  });

  test('sets how a test is reported and adds an antibiotic', async ({ page }) => {
    await page.goto('/lab/setup');
    await page.getByTestId('test-form-search').fill('haemo');
    await page.getByRole('combobox', { name: 'How Haemoglobin is reported' }).click();
    await page.getByRole('option', { name: 'Written report' }).click();
    await expect(page.getByText('Haemoglobin: written report.')).toBeVisible();
    expect(lab.forms.get(lab.tests[2]!.id)).toBe('descriptive');

    await page.getByRole('tab', { name: 'Antibiotics' }).click();
    await page.getByRole('button', { name: 'New antibiotic' }).click();
    const dialog = page.getByRole('dialog', { name: 'New antibiotic' });
    await dialog.getByLabel('Name').fill('Amikacin');
    await dialog.getByLabel('Class').fill('Aminoglycosides');
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('table', { name: 'Antibiotics' })).toContainText('Amikacin');
    await shot(page, 'lab-setup');
  });

  test('the worklist has no accessibility violations', async ({ page }) => {
    await page.goto('/lab');
    await expect(page.getByRole('heading', { name: 'Lab worklist', level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

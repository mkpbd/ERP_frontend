import type { Page, Route } from '@playwright/test';
import type { MockApi } from './mock-api';

/**
 * In-memory stand-in for the backend's laboratory (`/lab`): a bill to collect from, samples, results in their three
 * forms (values, culture, written text), the test forms and the culture masters. Installed after `mockApi`.
 */

const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const NOW = '2026-10-31T03:10:00.000Z';

export const LAB_PERMISSIONS = ['lab:read', 'lab:collect', 'lab:result', 'lab:verify', 'lab:manage'];

type Form = 'values' | 'culture' | 'descriptive';

interface MockResult {
  id: string;
  sampleId: string;
  line: number;
  testId: string;
  status: 'pending' | 'entered' | 'verified' | 'delivered' | 'rejected';
  form: Form | null;
  comment: string | null;
  values: {
    parameterId: string;
    name: string;
    unit: string | null;
    method: null;
    value: string | null;
    low: number | null;
    high: number | null;
    normalText: null;
    flag: 'low' | 'high' | null;
  }[];
  culture: Record<string, unknown> | null;
  narrative: string | null;
  enteredAt: string | null;
  verifiedAt: string | null;
  deliveredTo: string | null;
  version: number;
}

interface MockSample {
  id: string;
  labNumber: string;
  billId: string;
  departmentId: string;
  status: 'collected' | 'received' | 'rejected';
  rejectReason: string | null;
  version: number;
}

export class LabMock {
  readonly pathology = uuid(1);
  readonly bill = { id: uuid(2), number: 'DB-2026-00412' };
  readonly tests = [
    { id: uuid(11), name: 'Urine culture and sensitivity', line: 1 },
    { id: uuid(12), name: 'Histopathology (small biopsy)', line: 2 },
    { id: uuid(13), name: 'Haemoglobin', line: 3 },
  ];
  readonly forms = new Map<string, Form>([
    [uuid(11), 'culture'],
    [uuid(12), 'descriptive'],
  ]);
  readonly masters: Record<string, Record<string, unknown>[]> = {
    antibiotics: [
      { id: uuid(31), name: 'Meropenem', groupName: 'Carbapenems', isActive: true },
      { id: uuid(32), name: 'Ciprofloxacin', groupName: 'Fluoroquinolones', isActive: true },
    ],
    organisms: [
      { id: uuid(41), name: 'Escherichia coli', isActive: true },
      { id: uuid(42), name: 'Klebsiella pneumoniae', isActive: true },
    ],
    'growth-types': [{ id: uuid(51), name: 'Heavy growth' }],
    'culture-messages': [{ id: uuid(61), text: 'Repeat the culture after the course of antibiotics.' }],
    'report-templates': [
      {
        id: uuid(71),
        name: 'Benign skin lesion',
        description: 'Skin',
        body: 'GROSS:\nOne grey-white skin piece.\n\nMICROSCOPY:\nNo malignancy seen.',
      },
    ],
  };
  readonly samples: MockSample[] = [];
  readonly results: MockResult[] = [];
  readonly reports: string[] = [];

  constructor(private readonly api: MockApi) {}

  async install(page: Page): Promise<void> {
    await page.route('**/api/v1/lab/**', (route) => this.handle(route));
    await page.route('**/api/v1/reports/**', (route) => this.report(route));
  }

  private async report(route: Route): Promise<void> {
    const key = new URL(route.request().url()).pathname.split('/').at(-2) ?? '';
    this.reports.push(key);
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 mock' });
  }

  private order() {
    return {
      billNumber: this.bill.number,
      patientName: 'Rahima Begum',
      uhid: 260101,
      departmentName: 'Pathology',
    };
  }

  private record(result: MockResult) {
    const sample = this.samples.find((row) => row.id === result.sampleId)!;
    const test = this.tests.find((row) => row.id === result.testId)!;
    return {
      ...result,
      ...this.order(),
      labNumber: sample.labNumber,
      billId: this.bill.id,
      testName: test.name,
      collectedAt: NOW,
      enteredBy: null,
      verifiedBy: null,
      deliveredAt: null,
      reagents: null,
    };
  }

  private sampleView(sample: MockSample) {
    const results = this.results.filter((row) => row.sampleId === sample.id);
    return {
      ...sample,
      ...this.order(),
      patientId: uuid(81),
      collectedOn: NOW.slice(0, 10),
      collectedAt: NOW,
      tests: results.filter((row) => row.status !== 'rejected').length,
      verified: results.filter((row) => row.status === 'verified' || row.status === 'delivered').length,
      results: results.map((row) => this.record(row)),
    };
  }

  private named(list: string, id: unknown): string {
    const row = this.masters[list]!.find((candidate) => candidate['id'] === id);
    return String(row?.['name'] ?? row?.['text'] ?? '');
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1\/lab/, '');
    const method = request.method();
    this.api.calls.push(`${method} /lab${path}`);
    const json = (status: number, body?: unknown) =>
      route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        body: body === undefined ? '' : JSON.stringify(body),
      });
    const problem = (status: number, code: string, detail: string) =>
      json(status, {
        type: `urn:problem-type:${code}`,
        title: 'Error',
        status,
        code,
        detail,
        requestId: 'req-e2e',
      });
    const body = (): Record<string, unknown> => (request.postData() ? JSON.parse(request.postData()!) : {});
    const page = <T>(items: T[]) => ({ items, page: 1, pageSize: 20, total: items.length, totalPages: 1 });

    const orderMatch = path.match(/^\/orders\/(.+)$/);
    if (method === 'GET' && orderMatch) {
      if (decodeURIComponent(orderMatch[1]!).toUpperCase() !== this.bill.number) {
        return problem(404, 'diagnostic_bill_not_found', 'Diagnostic bill not found');
      }
      const inWork = new Set(this.results.filter((row) => row.status !== 'rejected').map((row) => row.line));
      return json(200, {
        billId: this.bill.id,
        billNumber: this.bill.number,
        billedAt: NOW,
        patientName: 'Rahima Begum',
        uhid: 260101,
        sex: 'female',
        dateOfBirth: '1990-01-01',
        departments: [
          {
            departmentId: this.pathology,
            departmentName: 'Pathology',
            tests: this.tests.map((test) => ({
              line: test.line,
              testName: test.name,
              inWork: inWork.has(test.line),
            })),
          },
        ],
      });
    }
    if (method === 'POST' && path === '/samples') {
      const sample: MockSample = {
        id: uuid(100 + this.samples.length),
        labNumber: `LB-261031-000${this.samples.length + 1}`,
        billId: this.bill.id,
        departmentId: this.pathology,
        status: 'collected',
        rejectReason: null,
        version: 1,
      };
      this.samples.push(sample);
      for (const test of this.tests) {
        this.results.push({
          id: uuid(200 + this.results.length),
          sampleId: sample.id,
          line: test.line,
          testId: test.id,
          status: 'pending',
          form: null,
          comment: null,
          values: [],
          culture: null,
          narrative: null,
          enteredAt: null,
          verifiedAt: null,
          deliveredTo: null,
          version: 1,
        });
      }
      return json(201, { id: sample.id, labNumber: sample.labNumber, tests: this.tests.length });
    }
    if (method === 'GET' && path === '/samples')
      return json(200, page(this.samples.map((row) => this.sampleView(row))));
    const sampleMatch = path.match(/^\/samples\/([^/]+)(\/\w+)?$/);
    if (sampleMatch) {
      const sample = this.samples.find((row) => row.id === sampleMatch[1]);
      if (!sample) return problem(404, 'sample_not_found', 'Sample not found');
      const action = sampleMatch[2];
      if (method === 'GET' && !action) return json(200, this.sampleView(sample));
      const input = body();
      if (input['version'] !== sample.version) return problem(409, 'stale_sample', 'The sample was changed');
      sample.version += 1;
      if (action === '/receive') sample.status = 'received';
      if (action === '/reject') Object.assign(sample, { status: 'rejected', rejectReason: input['reason'] });
      if (action === '/deliver') {
        for (const row of this.results.filter((candidate) => candidate.sampleId === sample.id)) {
          if (row.status === 'verified')
            Object.assign(row, { status: 'delivered', deliveredTo: input['to'] });
        }
      }
      return json(200, { results: 1 });
    }

    if (method === 'GET' && path === '/results') {
      const status = url.searchParams.get('status');
      return json(
        200,
        page(this.results.filter((row) => !status || row.status === status).map((row) => this.record(row))),
      );
    }
    const resultMatch = path.match(/^\/results\/([^/]+)(\/\w+)?$/);
    if (resultMatch) {
      const result = this.results.find((row) => row.id === resultMatch[1]);
      if (!result) return problem(404, 'result_not_found', 'Result not found');
      const action = resultMatch[2];
      const form = this.forms.get(result.testId) ?? 'values';
      if (method === 'GET' && !action) {
        const template =
          form === 'values'
            ? [
                {
                  parameterId: uuid(91),
                  name: 'Haemoglobin',
                  unit: 'g/dL',
                  kind: 'numeric',
                  low: 12,
                  high: 15.5,
                  normalText: null,
                },
              ]
            : [];
        return json(200, { ...this.record(result), form: result.form ?? form, template });
      }
      const input = body();
      if (input['version'] !== result.version) return problem(409, 'stale_result', 'The result was changed');
      const sample = this.samples.find((row) => row.id === result.sampleId)!;
      const entry = { undefined: 'values', '/culture': 'culture', '/text': 'descriptive' }[
        String(action) as 'undefined'
      ];
      if (method === 'PUT') {
        if (sample.status !== 'received')
          return problem(422, 'sample_state', 'The sample must be taken in by the lab first');
        if (entry !== form) return problem(422, 'wrong_form', 'The test is reported in another form');
        const { version: _version, comment, ...rest } = input;
        Object.assign(result, {
          status: 'entered',
          form,
          comment: comment ?? null,
          enteredAt: NOW,
          version: result.version + 1,
        });
        if (form === 'values') {
          const values = rest['values'] as { parameterId: string; value: string | null }[];
          const number = Number(values[0]?.value);
          result.values = [
            {
              parameterId: uuid(91),
              name: 'Haemoglobin',
              unit: 'g/dL',
              method: null,
              value: values[0]?.value ?? null,
              low: 12,
              high: 15.5,
              normalText: null,
              flag: number < 12 ? 'low' : number > 15.5 ? 'high' : null,
            },
          ];
        } else if (form === 'culture') {
          const organismIds = (rest['organismIds'] as string[]) ?? [];
          result.culture = {
            ...rest,
            growthType: rest['growthTypeId'] ? this.named('growth-types', rest['growthTypeId']) : null,
            organisms: organismIds.map((id) => ({ organismId: id, name: this.named('organisms', id) })),
            sensitivity: (
              (rest['sensitivity'] as { antibioticId: string; zone: string | null; results: string[] }[]) ??
              []
            ).map((row) => ({ ...row, antibiotic: this.named('antibiotics', row.antibioticId) })),
          };
        } else {
          result.narrative = String(rest['narrative']).replace(/\r\n?/g, '\n').trim();
        }
        return json(204);
      }
      if (action === '/verify') Object.assign(result, { status: 'verified', verifiedAt: NOW });
      if (action === '/unverify') Object.assign(result, { status: 'entered', verifiedAt: null });
      result.version += 1;
      return json(204);
    }

    if (method === 'GET' && path === '/tests') {
      const q = url.searchParams.get('q')?.toLowerCase() ?? '';
      return json(200, {
        items: this.tests
          .filter((test) => test.name.toLowerCase().includes(q))
          .map((test) => ({ id: test.id, name: test.name, form: this.forms.get(test.id) ?? 'values' })),
      });
    }
    const formMatch = path.match(/^\/tests\/([^/]+)\/form$/);
    if (method === 'PUT' && formMatch) {
      const form = body()['form'] as Form;
      if (form === 'values') this.forms.delete(formMatch[1]!);
      else this.forms.set(formMatch[1]!, form);
      return json(204);
    }

    const masterMatch = path.match(
      /^\/(antibiotics|organisms|growth-types|culture-messages|report-templates)(?:\/([^/]+))?$/,
    );
    if (masterMatch) {
      const list = this.masters[masterMatch[1]!]!;
      const id = masterMatch[2];
      if (method === 'GET' && !id) return json(200, list);
      if (method === 'GET')
        return json(
          200,
          list.find((row) => row['id'] === id),
        );
      if (method === 'POST') {
        const input = body();
        if (list.some((row) => row['name'] !== undefined && row['name'] === input['name'])) {
          return problem(409, 'antibiotic_name_taken', 'This antibiotic exists');
        }
        const created = { id: uuid(300 + list.length), ...input, createdAt: NOW, updatedAt: NOW };
        list.push(created);
        return json(201, created);
      }
      const row = list.find((candidate) => candidate['id'] === id);
      if (!row) return problem(404, 'not_found', 'Not found');
      if (method === 'PATCH') return (Object.assign(row, body()), json(200, row));
      if (method === 'DELETE') return (list.splice(list.indexOf(row), 1), json(204));
    }

    return problem(404, 'not_found', `No lab mock for ${method} /lab${path}`);
  }
}

/** Grants the signed-in super-admin the lab permissions and installs the lab mock. */
export async function mockLab(page: Page, api: MockApi): Promise<LabMock> {
  api.roles[0]!.permissions.push(...LAB_PERMISSIONS);
  const lab = new LabMock(api);
  await lab.install(page);
  return lab;
}

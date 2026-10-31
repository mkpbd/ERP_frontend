import type { Page, Route } from '@playwright/test';
import type { MockApi } from './mock-api';

/**
 * In-memory stand-in for the backend's test appointments and home collections (`/hospital`): the windows, areas and
 * their places, bookings, collectors, the diagnostic policy and the bill made from a booking. Installed after
 * `mockApi`.
 */

const uuid = (n: number) => `00000000-0000-4000-d000-${String(n).padStart(12, '0')}`;
const NOW = '2026-10-31T03:00:00.000Z';

export const DIAGNOSTIC_PERMISSIONS = [
  'diag:read',
  'diag:manage',
  'diag:bill',
  'diag:book',
  'diag:collect',
  'patient:read',
];

/** The local calendar day of a date, as the screens send it. */
export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type Row = Record<string, unknown> & { id: string };

interface MockTest {
  testId: string;
  testName: string;
  departmentName: string;
  rate: number;
}

const paisa = (value: number) => Math.round(value * 100);
const sum = (values: number[]) => values.reduce((total, value) => total + paisa(value), 0) / 100;

export class DiagnosticMock {
  readonly departments = [
    { id: uuid(1), name: 'Pathology', kind: 'lab' },
    { id: uuid(2), name: 'Radiology', kind: 'imaging' },
    { id: uuid(3), name: 'Services', kind: 'other' },
  ];
  readonly tests = [
    { id: uuid(11), name: 'Complete blood count', departmentId: uuid(1), rate: 400 },
    { id: uuid(12), name: 'Lipid profile', departmentId: uuid(1), rate: 900 },
    { id: uuid(13), name: 'X-ray chest PA', departmentId: uuid(2), rate: 600 },
    { id: uuid(14), name: 'Home collection charge', departmentId: uuid(3), rate: 0 },
  ].map((test) => ({ ...test, shortName: null, code: null, isActive: true }));
  readonly records: Record<string, Row[]> = {
    'test-appointment-windows': [
      {
        id: uuid(21),
        label: 'Morning lab',
        startTime: '08:00',
        endTime: '10:00',
        capacity: 2,
        departmentId: uuid(1),
        displayOrder: 0,
        isActive: true,
      },
      {
        id: uuid(22),
        label: 'All day',
        startTime: '00:00',
        endTime: '23:59',
        capacity: 10,
        departmentId: null,
        displayOrder: 1,
        isActive: true,
      },
    ],
    'home-collection-areas': [
      { id: uuid(31), name: 'Kolatoli', charge: 200, minimumOrder: 1000, days: [], isActive: true },
    ],
    'home-collection-windows': [
      { id: uuid(41), label: '08:00 AM - 10:00 AM', displayOrder: 0, isActive: true },
    ],
    'card-providers': [],
    'test-preparations': [],
  };
  readonly patients = [
    { id: uuid(51), uhid: 260101, fullName: 'Abdul Karim', sex: 'male', mobileNo: '01711000000' },
  ];
  readonly appointments: Row[] = [];
  readonly collections: Row[] = [];
  readonly bills: Row[] = [];
  readonly reports: { key: string; params: Record<string, unknown> }[] = [];
  policy = {
    counterDiscountPercent: 10,
    defaultReferralPercent: 0,
    homeCollectionTestId: null as string | null,
  };
  private serial = 0;

  constructor(private readonly api: MockApi) {}

  /** A booking of each kind today (the visit given to ), for screens that only look. */
  seed(collectorId: string | null = null): void {
    const today = toDay(new Date());
    const lipid: MockTest = {
      testId: uuid(12),
      testName: 'Lipid profile',
      departmentName: 'Pathology',
      rate: 900,
    };
    this.appointments.push({
      id: uuid(290),
      number: 'TA-2026-00009',
      appointmentDate: today,
      windowId: uuid(22),
      windowLabel: 'All day',
      startTime: '00:00',
      endTime: '23:59',
      serial: 3,
      patientId: null,
      uhid: null,
      patientName: 'Nasir Uddin',
      mobileNo: '01911000000',
      tests: [lipid],
      amount: 900,
      status: 'booked',
      statusReason: null,
      billId: null,
      billNumber: null,
      remarks: null,
      bookedVia: 'portal',
      bookedByName: null,
      createdAt: NOW,
      version: 1,
    });
    this.collections.push({
      id: uuid(390),
      number: 'HC-2026-00009',
      collectionDate: today,
      windowId: uuid(41),
      windowLabel: '08:00 AM - 10:00 AM',
      areaId: uuid(31),
      areaName: 'Kolatoli',
      address: 'House 12, Road 3',
      landmark: 'the mosque',
      patientId: null,
      uhid: null,
      patientName: 'Nasir Uddin',
      mobileNo: '01911000000',
      tests: [lipid],
      amount: 900,
      charge: 200,
      total: 1100,
      status: collectorId ? 'assigned' : 'booked',
      statusReason: null,
      collectorId,
      collectorName: collectorId ? 'Mel Member' : null,
      assignedAt: null,
      collectedAt: null,
      collectedByName: null,
      collectionNote: null,
      billId: null,
      billNumber: null,
      billDue: null,
      patientNote: 'Fasting from 10 pm',
      bookedVia: 'portal',
      bookedByName: null,
      createdAt: NOW,
      version: 2,
    });
  }

  /** The users given diag:collect (the mock's member, when made a collector). */
  collectors(): { id: string; displayName: string }[] {
    const roles = new Set(
      this.api.roles.filter((role) => role.permissions.includes('diag:collect')).map((role) => role.id),
    );
    return this.api.users
      .filter(
        (user) => user.roleIds.some((id) => roles.has(id)) && !user.roleIds.includes(this.api.roles[0]!.id),
      )
      .map((user) => ({ id: user.id, displayName: user.displayName }));
  }

  async install(page: Page): Promise<void> {
    await page.route('**/api/v1/hospital/**', (route) => this.handle(route));
    await page.route('**/api/v1/reports/**', async (route) => {
      const body = route.request().postDataJSON() as { params: Record<string, unknown> };
      this.reports.push({
        key: new URL(route.request().url()).pathname.split('/').at(-2) ?? '',
        params: body.params,
      });
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 mock' });
    });
  }

  private booked(testIds: string[]): MockTest[] {
    return testIds.map((id) => {
      const test = this.tests.find((option) => option.id === id)!;
      const department = this.departments.find((option) => option.id === test.departmentId)!;
      return { testId: test.id, testName: test.name, departmentName: department.name, rate: test.rate };
    });
  }

  private places(date: string, departmentId: string | null) {
    return this.records['test-appointment-windows']!.filter(
      (window) =>
        window['isActive'] &&
        (!departmentId || !window['departmentId'] || window['departmentId'] === departmentId),
    ).map((window) => {
      const booked = this.appointments.filter(
        (row) =>
          row['windowId'] === window.id && row['appointmentDate'] === date && row['status'] !== 'cancelled',
      ).length;
      const capacity = window['capacity'] as number;
      return {
        id: window.id,
        label: window['label'],
        startTime: window['startTime'],
        endTime: window['endTime'],
        departmentId: window['departmentId'],
        departmentName:
          this.departments.find((department) => department.id === window['departmentId'])?.name ?? null,
        capacity,
        booked,
        left: Math.max(0, capacity - booked),
        over: false,
      };
    });
  }

  private count(rows: Row[], key: (row: Row) => string[]) {
    const counts = new Map<string, { live: number; cancelled: number }>();
    for (const row of rows) {
      for (const name of key(row)) {
        const count = counts.get(name) ?? { live: 0, cancelled: 0 };
        if (row['status'] === 'cancelled') count.cancelled += 1;
        else count.live += 1;
        counts.set(name, count);
      }
    }
    return [...counts].map(([name, count]) => ({ key: name, ...count }));
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1\/hospital/, '');
    const method = request.method();
    const query = url.searchParams;
    this.api.calls.push(`${method} /hospital${path}${url.search}`);
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    const json = (status: number, payload?: unknown) =>
      route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        body: payload === undefined ? '' : JSON.stringify(payload),
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
    const me = this.api.users.find((user) => user.email === 'member@example.com')!;

    if (method === 'GET' && path === '/diagnostic-departments') return json(200, this.departments);
    if (method === 'GET' && path === '/diagnostic-tests') {
      const q = (query.get('q') ?? '').toLowerCase();
      return json(
        200,
        this.tests.filter((test) => test.name.toLowerCase().includes(q)),
      );
    }
    if (method === 'GET' && path === '/patients') {
      const q = (query.get('q') ?? '').toLowerCase();
      const items = this.patients.filter((patient) => patient.fullName.toLowerCase().includes(q));
      return json(200, { items, total: items.length, page: 1, pageSize: 20 });
    }
    if (path === '/diagnostic-policy') {
      if (method === 'PUT') {
        this.policy = body as typeof this.policy;
        return json(204);
      }
      return json(200, this.policy);
    }
    if (method === 'GET' && path === '/home-collectors') return json(200, { items: this.collectors() });

    const record =
      /^\/(test-appointment-windows|home-collection-areas|home-collection-windows|card-providers|test-preparations)(?:\/([^/]+))?$/.exec(
        path,
      );
    if (record) {
      const rows = this.records[record[1]!]!;
      const id = record[2];
      if (method === 'GET' && !id) {
        const active = query.get('isActive');
        return json(200, active ? rows.filter((row) => String(row['isActive']) === active) : rows);
      }
      if (method === 'POST') {
        const row = { ...body, id: uuid(100 + rows.length + this.serial++) } as Row;
        rows.push(row);
        return json(201, row);
      }
      const index = rows.findIndex((row) => row.id === id);
      if (method === 'PATCH') {
        rows[index] = { ...rows[index]!, ...body };
        return json(200, rows[index]);
      }
      if (method === 'DELETE') {
        rows.splice(index, 1);
        return json(204);
      }
    }

    if (method === 'GET' && path === '/test-appointment-availability') {
      return json(200, { items: this.places(query.get('date')!, query.get('departmentId')) });
    }
    if (path === '/test-appointments' && method === 'GET') {
      const from = query.get('from')!;
      const departmentId = query.get('departmentId');
      const department = this.departments.find((option) => option.id === departmentId)?.name;
      const items = this.appointments.filter(
        (row) =>
          row['appointmentDate'] === from &&
          (!department || (row['tests'] as MockTest[]).some((test) => test.departmentName === department)),
      );
      const status = (value: string) => items.filter((row) => row['status'] === value).length;
      return json(200, {
        items,
        summary: {
          total: items.length,
          booked: status('booked'),
          billed: status('billed'),
          noShow: status('no_show'),
          cancelled: status('cancelled'),
          amount: sum(
            items.filter((row) => row['status'] !== 'cancelled').map((row) => row['amount'] as number),
          ),
          byDepartment: this.count(items, (row) => [
            ...new Set((row['tests'] as MockTest[]).map((test) => test.departmentName)),
          ]),
          byTest: this.count(items, (row) => (row['tests'] as MockTest[]).map((test) => test.testName)),
          byWindow: this.count(items, (row) => [String(row['windowLabel'])]),
        },
      });
    }
    if (path === '/test-appointments' && method === 'POST') {
      const date = body['appointmentDate'] as string;
      const window = this.places(date, null).find((option) => option.id === body['windowId'])!;
      if (window.left === 0)
        return problem(422, 'fully_booked', `All ${window.capacity} places of the window are booked`);
      const patient = this.patients.find((option) => option.id === body['patientId']);
      const tests = this.booked(body['testIds'] as string[]);
      const taken = new Set(
        this.appointments
          .filter(
            (row) =>
              row['windowId'] === window.id &&
              row['appointmentDate'] === date &&
              row['status'] !== 'cancelled',
          )
          .map((row) => row['serial'] as number),
      );
      let serial = 1;
      while (taken.has(serial)) serial += 1;
      const row: Row = {
        id: uuid(200 + this.appointments.length),
        number: `TA-2026-${String(this.appointments.length + 1).padStart(5, '0')}`,
        appointmentDate: date,
        windowId: window.id,
        windowLabel: window.label,
        startTime: window.startTime,
        endTime: window.endTime,
        serial,
        patientId: patient?.id ?? null,
        uhid: patient?.uhid ?? null,
        patientName: patient?.fullName ?? body['patientName'],
        mobileNo: patient?.mobileNo ?? body['mobileNo'],
        tests,
        amount: sum(tests.map((test) => test.rate)),
        status: 'booked',
        statusReason: null,
        billId: null,
        billNumber: null,
        remarks: body['remarks'] ?? null,
        bookedVia: 'desk',
        bookedByName: 'Ada Admin',
        createdAt: NOW,
        version: 1,
      };
      this.appointments.push(row);
      return json(201, { id: row.id, number: row['number'], serial });
    }
    const appointment = /^\/test-appointments\/([^/]+)\/(no-show|cancel)$/.exec(path);
    if (appointment && method === 'POST') {
      const row = this.appointments.find((option) => option.id === appointment[1])!;
      Object.assign(row, {
        status: appointment[2] === 'cancel' ? 'cancelled' : 'no_show',
        statusReason: body['reason'] ?? null,
        version: (row['version'] as number) + 1,
      });
      return json(204);
    }

    if (path === '/home-collections' && method === 'GET') {
      const from = query.get('from')!;
      const collectorId = query.get('collectorId');
      const owner = collectorId === 'me' ? me.id : collectorId;
      const items = this.collections.filter(
        (row) => row['collectionDate'] === from && (!owner || row['collectorId'] === owner),
      );
      const live = items.filter((row) => row['status'] !== 'cancelled');
      const status = (value: string) => items.filter((row) => row['status'] === value).length;
      return json(200, {
        items,
        summary: {
          total: items.length,
          booked: status('booked'),
          assigned: status('assigned'),
          collected: status('collected'),
          cancelled: status('cancelled'),
          unbilled: live.filter((row) => !row['billId']).length,
          amount: sum(live.map((row) => row['total'] as number)),
          byArea: this.count(items, (row) => [String(row['areaName'])]),
          byCollector: this.count(items, (row) => [String(row['collectorName'] ?? 'Not given')]),
          byWindow: this.count(items, (row) => [String(row['windowLabel'])]),
        },
      });
    }
    if (path === '/home-collections' && method === 'POST') {
      const area = this.records['home-collection-areas']!.find((option) => option.id === body['areaId'])!;
      const window = this.records['home-collection-windows']!.find(
        (option) => option.id === body['windowId'],
      )!;
      const tests = this.booked(body['testIds'] as string[]);
      const amount = sum(tests.map((test) => test.rate));
      if (amount < (area['minimumOrder'] as number)) {
        return problem(
          422,
          'below_minimum',
          `The tests come to ${amount.toFixed(2)}; too little for ${area['name']}`,
        );
      }
      const patient = this.patients.find((option) => option.id === body['patientId']);
      const row: Row = {
        id: uuid(300 + this.collections.length),
        number: `HC-2026-${String(this.collections.length + 1).padStart(5, '0')}`,
        collectionDate: body['collectionDate'],
        windowId: window.id,
        windowLabel: window['label'],
        areaId: area.id,
        areaName: area['name'],
        address: body['address'],
        landmark: body['landmark'] ?? null,
        patientId: patient?.id ?? null,
        uhid: patient?.uhid ?? null,
        patientName: patient?.fullName ?? body['patientName'],
        mobileNo: patient?.mobileNo ?? body['mobileNo'],
        tests,
        amount,
        charge: area['charge'],
        total: sum([amount, area['charge'] as number]),
        status: 'booked',
        statusReason: null,
        collectorId: null,
        collectorName: null,
        assignedAt: null,
        collectedAt: null,
        collectedByName: null,
        collectionNote: null,
        billId: null,
        billNumber: null,
        billDue: null,
        patientNote: body['note'] ?? null,
        bookedVia: 'desk',
        bookedByName: 'Ada Admin',
        createdAt: NOW,
        version: 1,
      };
      this.collections.push(row);
      return json(201, { id: row.id, number: row['number'] });
    }
    const collection = /^\/home-collections\/([^/]+)\/(assign|collected|cancel)$/.exec(path);
    if (collection && method === 'POST') {
      const row = this.collections.find((option) => option.id === collection[1])!;
      if (body['version'] !== row['version']) return problem(409, 'stale_booking', 'Reload it');
      const step = collection[2];
      if (step === 'assign') {
        const collector = this.collectors().find((option) => option.id === body['collectorId'])!;
        Object.assign(row, {
          status: 'assigned',
          collectorId: collector.id,
          collectorName: collector.displayName,
        });
      } else if (step === 'collected') {
        Object.assign(row, { status: 'collected', collectedAt: NOW, collectionNote: body['note'] ?? null });
      } else {
        Object.assign(row, { status: 'cancelled', statusReason: body['reason'] });
      }
      row['version'] = (row['version'] as number) + 1;
      return json(204);
    }

    if (path === '/diagnostic-bills' && method === 'POST') {
      const booking =
        this.appointments.find((row) => row.id === body['testAppointmentId']) ??
        this.collections.find((row) => row.id === body['homeCollectionId'])!;
      const charge = (booking['charge'] as number | undefined) ?? 0;
      const net = sum([...this.booked(body['testIds'] as string[]).map((test) => test.rate), charge]);
      const paid = (body['payment'] as { amount: number } | null)?.amount ?? 0;
      const bill: Row = {
        id: uuid(400 + this.bills.length),
        number: `DB-2026-${String(this.bills.length + 1).padStart(5, '0')}`,
        ...body,
      };
      this.bills.push(bill);
      const patient = this.patients.find((option) => option.id === body['patientId'])!;
      Object.assign(booking, {
        billId: bill.id,
        billNumber: bill['number'],
        billDue: sum([net, -paid]),
        patientId: patient.id,
        uhid: patient.uhid,
        patientName: patient.fullName,
        ...(body['testAppointmentId'] ? { status: 'billed' } : {}),
      });
      return json(201, { id: bill.id, number: bill['number'], net, due: sum([net, -paid]) });
    }

    return problem(404, 'not_found', `No diagnostic mock for ${method} /hospital${path}`);
  }
}

export async function mockDiagnostic(page: Page, api: MockApi): Promise<DiagnosticMock> {
  api.roles[0]!.permissions.push(...DIAGNOSTIC_PERMISSIONS);
  const diagnostic = new DiagnosticMock(api);
  await diagnostic.install(page);
  return diagnostic;
}

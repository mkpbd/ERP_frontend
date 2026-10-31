import type { Page, Route } from '@playwright/test';
import type { MockApi } from './mock-api';

/**
 * In-memory stand-in for the backend's operation theatre (`/hospital/ot-*`) and what its screens choose from
 * (admissions, doctors, services), shaped like the real responses. Installed after `mockApi`, so it answers
 * `/hospital/**` and `/reports/**` before the base mock does.
 */

const uuid = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;
const NOW = '2026-10-01T09:00:00.000Z';

export const OT_PERMISSIONS = [
  'opd:read',
  'ipd:read',
  'ipd:bill',
  'ot:read',
  'ot:request',
  'ot:schedule',
  'ot:note',
  'ot:manage',
];

type Status = 'requested' | 'scheduled' | 'in_progress' | 'done' | 'cancelled';

interface MockCase {
  id: string;
  number: string;
  status: Status;
  admissionId: string;
  operationId: string;
  otTypeId: string | null;
  anaesthesiaTypeId: string | null;
  surgeonId: string;
  anaesthetistId: string | null;
  indication: string | null;
  team: { doctorId: string; role: 'assistant' | 'anaesthesia_assistant' }[];
  requestedFor: string;
  otRoomId: string | null;
  scheduledFrom: string | null;
  scheduledTo: string | null;
  startedAt: string | null;
  endedAt: string | null;
  cancelReason: string | null;
  incision: string | null;
  findings: string | null;
  procedureDone: string | null;
  specimen: string | null;
  postOpOrders: string | null;
  noteSignedAt: string | null;
  noteSignedByName: string | null;
  version: number;
}

interface MockCharge {
  id: string;
  caseId: string;
  serviceId: string;
  doctorId: string | null;
  qty: number;
  status: 'active' | 'cancelled';
}

/** The local calendar day of an instant. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function at(day: string, hours: number, minutes = 0): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hours, minutes).toISOString();
}

export class OtMock {
  readonly today = localDay(new Date());
  readonly masters: Record<string, Record<string, unknown>[]> = {
    'ot-rooms': [
      { id: uuid(1), name: 'OT-1', floor: '3rd floor', description: null, isActive: true },
      { id: uuid(2), name: 'OT-2', floor: '3rd floor', description: null, isActive: true },
    ],
    operations: [
      { id: uuid(11), name: 'Caesarean section', isActive: true },
      { id: uuid(12), name: 'Appendectomy', isActive: true },
    ],
    'ot-types': [{ id: uuid(21), name: 'Major' }],
    'anaesthesia-types': [
      { id: uuid(31), name: 'Spinal' },
      { id: uuid(32), name: 'General' },
    ],
    'surgery-procedures': [{ id: uuid(41), title: 'LSCS', area: 'Obstetrics', description: 'Steps…' }],
  };
  readonly doctors = [
    { id: uuid(51), name: 'Dr. Nusrat Jahan', degrees: 'MBBS, FCPS (Obs & Gynae)', isActive: true },
    { id: uuid(52), name: 'Dr. Kamal Hossain', degrees: 'MBBS, DA', isActive: true },
    { id: uuid(53), name: 'Dr. Farhana Akter', degrees: 'MBBS', isActive: true },
  ];
  readonly services = [
    { id: uuid(61), name: 'Surgeon fee (major)', code: 'OT-SF', rate: 15000, sharePercent: 70 },
    { id: uuid(62), name: 'OT charge', code: 'OT-CH', rate: 5000, sharePercent: null },
  ];
  readonly admissions = [
    {
      id: uuid(71),
      number: 'IPD-2026-00042',
      patientId: uuid(81),
      uhid: 260101,
      patientName: 'Rahima Begum',
      bedCode: 'W-12',
      wardName: 'Gynae ward',
    },
    {
      id: uuid(72),
      number: 'IPD-2026-00043',
      patientId: uuid(82),
      uhid: 260102,
      patientName: 'Abdul Karim',
      bedCode: 'S-3',
      wardName: 'Surgery ward',
    },
  ];
  readonly cases: MockCase[] = [
    this.make(1, uuid(72), uuid(12), 'scheduled', {
      otRoomId: uuid(1),
      scheduledFrom: at(this.today, 9),
      scheduledTo: at(this.today, 10, 30),
    }),
  ];
  readonly charges: MockCharge[] = [];
  readonly reports: string[] = [];
  private counter = 1;

  constructor(private readonly api: MockApi) {}

  async install(page: Page): Promise<void> {
    await page.route('**/api/v1/hospital/**', (route) => this.handle(route));
    await page.route('**/api/v1/reports/**', (route) => this.report(route));
  }

  private make(
    n: number,
    admissionId: string,
    operationId: string,
    status: Status,
    extra: Partial<MockCase> = {},
  ): MockCase {
    return {
      id: uuid(900 + n),
      number: `OT-2026-${String(n).padStart(5, '0')}`,
      status,
      admissionId,
      operationId,
      otTypeId: uuid(21),
      anaesthesiaTypeId: uuid(32),
      surgeonId: uuid(51),
      anaesthetistId: uuid(52),
      indication: null,
      team: [],
      requestedFor: this.today,
      otRoomId: null,
      scheduledFrom: null,
      scheduledTo: null,
      startedAt: null,
      endedAt: null,
      cancelReason: null,
      incision: null,
      findings: null,
      procedureDone: null,
      specimen: null,
      postOpOrders: null,
      noteSignedAt: null,
      noteSignedByName: null,
      version: 1,
      ...extra,
    };
  }

  private name(list: Record<string, unknown>[], id: string | null): string | null {
    return (list.find((row) => row['id'] === id)?.['name'] as string | undefined) ?? null;
  }

  private doctorName(id: string | null): string | null {
    return this.doctors.find((doctor) => doctor.id === id)?.name ?? null;
  }

  private summary(item: MockCase) {
    const admission = this.admissions.find((row) => row.id === item.admissionId)!;
    return {
      id: item.id,
      number: item.number,
      status: item.status,
      admissionId: item.admissionId,
      admissionNumber: admission.number,
      patientId: admission.patientId,
      uhid: admission.uhid,
      patientName: admission.patientName,
      operationName: this.name(this.masters['operations']!, item.operationId),
      surgeonName: this.doctorName(item.surgeonId),
      requestedFor: item.requestedFor,
      otRoomId: item.otRoomId,
      otRoomName: this.name(this.masters['ot-rooms']!, item.otRoomId),
      scheduledFrom: item.scheduledFrom,
      scheduledTo: item.scheduledTo,
    };
  }

  private view(item: MockCase) {
    const charges = this.charges
      .filter((charge) => charge.caseId === item.id)
      .map((charge) => {
        const service = this.services.find((row) => row.id === charge.serviceId)!;
        return {
          id: charge.id,
          serviceName: service.name,
          doctorName: this.doctorName(charge.doctorId),
          qty: charge.qty,
          rate: service.rate,
          amount: service.rate * charge.qty,
          status: charge.status,
        };
      });
    return {
      ...item,
      ...this.summary(item),
      otTypeName: this.name(this.masters['ot-types']!, item.otTypeId),
      anaesthesiaTypeName: this.name(this.masters['anaesthesia-types']!, item.anaesthesiaTypeId),
      anaesthetistName: this.doctorName(item.anaesthetistId),
      team: item.team.map((member) => ({ ...member, doctorName: this.doctorName(member.doctorId) })),
      charges,
      chargedTotal: charges
        .filter((row) => row.status === 'active')
        .reduce((sum, row) => sum + row.amount, 0),
    };
  }

  private async report(route: Route): Promise<void> {
    const key = new URL(route.request().url()).pathname.split('/').at(-2) ?? '';
    this.reports.push(key);
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 mock' });
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1\/hospital/, '');
    const method = request.method();
    this.api.calls.push(`${method} /hospital${path}`);
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

    if (method === 'GET' && path === '/ot-board') {
      const day = url.searchParams.get('day') ?? this.today;
      const live = this.cases.filter((item) => item.status !== 'cancelled');
      return json(200, {
        day,
        rooms: this.masters['ot-rooms']!.filter((room) => room['isActive']).map((room) => ({
          id: room['id'],
          name: room['name'],
          floor: room['floor'],
          cases: live
            .filter(
              (item) =>
                item.otRoomId === room['id'] &&
                item.scheduledFrom &&
                localDay(new Date(item.scheduledFrom)) === day,
            )
            .map((item) => this.summary(item)),
        })),
        waiting: live
          .filter((item) => item.status === 'requested' && item.requestedFor <= day)
          .map((item) => this.summary(item)),
      });
    }
    if (method === 'GET' && path === '/ot-cases') {
      const status = url.searchParams.get('status');
      const items = this.cases
        .filter((item) => !status || item.status === status)
        .map((item) => this.summary(item));
      return json(200, { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 });
    }
    if (method === 'POST' && path === '/ot-cases') {
      const input = body() as Partial<MockCase> & { admissionId: string; requestedFor: string };
      const created = this.make(++this.counter, input.admissionId, input.operationId!, 'requested', {
        ...input,
        status: 'requested',
      });
      this.cases.push(created);
      return json(201, { id: created.id, number: created.number });
    }
    const caseMatch = path.match(/^\/ot-cases\/([^/]+)(\/.*)?$/);
    if (caseMatch) {
      const item = this.cases.find((row) => row.id === caseMatch[1]);
      if (!item) return problem(404, 'not_found', 'Operation not found');
      const sub = caseMatch[2] ?? '';
      if (method === 'GET' && sub === '') return json(200, this.view(item));
      const input = body();
      if (input['version'] !== item.version)
        return problem(409, 'stale_ot_case', 'The operation was changed meanwhile');
      const done = () => {
        item.version += 1;
        return json(200, { version: item.version });
      };
      const { version: _version, ...rest } = input;
      if (method === 'PUT' && sub === '') return (Object.assign(item, rest), done());
      if (method === 'POST' && sub === '/schedule') {
        const from = String(input['from']);
        const to = String(input['to']);
        const clash = this.cases.find(
          (other) =>
            other.id !== item.id &&
            other.otRoomId === input['roomId'] &&
            (other.status === 'scheduled' || other.status === 'in_progress') &&
            other.scheduledFrom! < to &&
            from < other.scheduledTo!,
        );
        if (clash) return problem(409, 'room_taken', `The room is taken by ${clash.number} then`);
        Object.assign(item, {
          status: 'scheduled',
          otRoomId: input['roomId'],
          scheduledFrom: from,
          scheduledTo: to,
        });
        return done();
      }
      if (method === 'POST' && sub === '/start')
        return (
          Object.assign(item, { status: 'in_progress', startedAt: input['at'] ?? new Date().toISOString() }),
          done()
        );
      if (method === 'POST' && sub === '/finish')
        return (
          Object.assign(item, { status: 'done', endedAt: input['at'] ?? new Date().toISOString() }),
          done()
        );
      if (method === 'POST' && sub === '/cancel')
        return (Object.assign(item, { status: 'cancelled', cancelReason: input['reason'] }), done());
      if (method === 'PUT' && sub === '/note') return (Object.assign(item, rest), done());
      if (method === 'POST' && sub === '/note/sign') {
        Object.assign(item, {
          noteSignedAt: new Date().toISOString(),
          noteSignedByName: this.doctorName(item.surgeonId),
        });
        return done();
      }
    }

    if (method === 'GET' && path === '/admissions') {
      const q = url.searchParams.get('q')?.toLowerCase() ?? '';
      const items = this.admissions.filter(
        (row) =>
          !q ||
          row.patientName.toLowerCase().includes(q) ||
          row.number.toLowerCase().includes(q) ||
          String(row.uhid) === q,
      );
      return json(200, { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 });
    }
    const chargeMatch = path.match(/^\/admissions\/([^/]+)\/charges(?:\/([^/]+)\/cancel)?$/);
    if (chargeMatch && method === 'POST') {
      const input = body();
      if (chargeMatch[2]) {
        const charge = this.charges.find((row) => row.id === chargeMatch[2]);
        if (charge) charge.status = 'cancelled';
        return json(204);
      }
      this.charges.push({
        id: uuid(700 + this.charges.length),
        caseId: String(input['otCaseId']),
        serviceId: String(input['serviceId']),
        doctorId: (input['doctorId'] as string | null) ?? null,
        qty: Number(input['qty'] ?? 1),
        status: 'active',
      });
      return json(201, { id: uuid(700 + this.charges.length - 1) });
    }
    if (method === 'GET' && path === '/doctors') return json(200, this.doctors);
    if (method === 'GET' && path === '/services') return json(200, this.services);

    const masterMatch = path.match(
      /^\/(ot-rooms|operations|ot-types|anaesthesia-types|surgery-procedures)(?:\/([^/]+))?$/,
    );
    if (masterMatch) {
      const list = this.masters[masterMatch[1]!]!;
      const id = masterMatch[2];
      if (method === 'GET' && !id) return json(200, list);
      if (method === 'POST' && !id) {
        const input = body();
        const key = 'title' in input ? 'title' : 'name';
        if (list.some((row) => row[key] === input[key]))
          return problem(409, 'ot_room_name_taken', 'This OT room exists');
        const created = {
          id: uuid(400 + list.length + 10 * this.counter++),
          ...input,
          createdAt: NOW,
          updatedAt: NOW,
        };
        list.push(created);
        return json(201, created);
      }
      const row = list.find((candidate) => candidate['id'] === id);
      if (!row) return problem(404, 'not_found', 'Not found');
      if (method === 'PATCH') return (Object.assign(row, body()), json(200, row));
      if (method === 'DELETE') return (list.splice(list.indexOf(row), 1), json(204));
    }

    return problem(404, 'not_found', `No OT mock for ${method} /hospital${path}`);
  }
}

/** Grants the signed-in super-admin the OT permissions and installs the OT mock. */
export async function mockOt(page: Page, api: MockApi): Promise<OtMock> {
  api.roles[0]!.permissions.push(...OT_PERMISSIONS);
  const ot = new OtMock(api);
  await ot.install(page);
  return ot;
}

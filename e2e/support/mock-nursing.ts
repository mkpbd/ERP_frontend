import type { Page, Route } from '@playwright/test';
import type { MockApi } from './mock-api';

/**
 * In-memory stand-in for the backend's nursing records (`/clinical`): the rounds and their board, observations with
 * their flags, and medicine and care orders charted by the day. Installed after `mockApi`.
 */

const uuid = (n: number) => `00000000-0000-4000-c000-${String(n).padStart(12, '0')}`;
const NOW = '2026-10-31T03:00:00.000Z';

export const NURSING_PERMISSIONS = ['emr:read', 'emr:write', 'emr:order', 'rx:read', 'rx:manage', 'ipd:read'];

/** The local calendar day of a date, as the screens send it. */
function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A time of day on a local day, as an ISO instant. */
const at = (day: string, time: string) => new Date(`${day}T${time}:00`).toISOString();

interface MockObservation {
  id: string;
  admissionId: string;
  takenAt: string;
  roundName: string | null;
  values: Record<string, unknown>;
  flags: string[];
  struckAt: string | null;
  struckReason: string | null;
}

interface MockDose {
  id: string;
  dueAt: string | null;
  outcome: 'given' | 'missed';
  givenAt: string | null;
  reason: string | null;
}

interface MockOrder {
  id: string;
  admissionId: string;
  kind: 'medicine' | 'care';
  drugName: string;
  dose: string | null;
  route: string | null;
  schedule: 'times' | 'interval' | 'once' | 'prn';
  times: string[];
  intervalHours: number | null;
  startAt: string;
  note: string | null;
  status: 'active' | 'held' | 'stopped';
  version: number;
  records: MockDose[];
}

export class NursingMock {
  readonly stays = [
    {
      id: uuid(1),
      number: 'IP-2026-00001',
      patientName: 'Rahima Begum',
      uhid: 260101,
      wardName: 'General ward',
      bedCode: 'W-1',
      status: 'admitted',
    },
    {
      id: uuid(2),
      number: 'IP-2026-00002',
      patientName: 'Abdul Karim',
      uhid: 260102,
      wardName: 'General ward',
      bedCode: 'W-2',
      status: 'discharged',
    },
  ];
  readonly rounds: Record<string, unknown>[] = [
    { id: uuid(11), name: 'Morning', startTime: '06:00', endTime: '10:00', isActive: true, version: 1 },
    { id: uuid(12), name: 'Evening', startTime: '16:00', endTime: '20:00', isActive: true, version: 1 },
  ];
  readonly medicines = [
    { id: uuid(21), name: 'Napa 500', genericName: 'Paracetamol' },
    { id: uuid(22), name: 'Seclo 20', genericName: 'Omeprazole' },
  ];
  readonly observations: MockObservation[] = [];
  readonly orders: MockOrder[] = [];
  readonly reports: string[] = [];
  private serial = 100;

  constructor(private readonly api: MockApi) {
    const today = toDay(new Date());
    this.observations.push({
      id: uuid(31),
      admissionId: uuid(1),
      takenAt: at(today, '07:00'),
      roundName: 'Morning',
      values: { temperatureF: 98.6, pulse: 82, respRate: 18, systolic: 120, diastolic: 80, spo2: 98 },
      flags: [],
      struckAt: null,
      struckReason: null,
    });
  }

  async install(page: Page): Promise<void> {
    await page.route('**/api/v1/clinical/**', (route) => this.handle(route));
    await page.route('**/api/v1/reports/**', async (route) => {
      this.reports.push(new URL(route.request().url()).pathname.split('/').at(-2) ?? '');
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 mock' });
    });
  }

  private activeRounds() {
    return this.rounds
      .filter((round) => round['isActive'])
      .sort((a, b) => String(a['startTime']).localeCompare(String(b['startTime'])));
  }

  private observationView(row: MockObservation) {
    const empty = {
      temperatureF: null,
      pulse: null,
      respRate: null,
      systolic: null,
      diastolic: null,
      spo2: null,
      painScore: null,
      bloodSugar: null,
      intakeMl: null,
      outputMl: null,
      consciousness: null,
      note: null,
    };
    return {
      ...empty,
      ...row.values,
      id: row.id,
      takenAt: row.takenAt,
      roundName: row.roundName,
      recordedByName: 'Nurse Shirin',
      struckAt: row.struckAt,
      struckByName: row.struckAt ? 'Nurse Shirin' : null,
      struckReason: row.struckReason,
      flags: row.flags,
    };
  }

  private flags(values: Record<string, unknown>): string[] {
    const n = (key: string) => (typeof values[key] === 'number' ? (values[key] as number) : null);
    const flags: string[] = [];
    const temperature = n('temperatureF');
    const pulse = n('pulse');
    const spo2 = n('spo2');
    const systolic = n('systolic');
    if (temperature !== null && temperature >= 100.4) flags.push('fever');
    if (temperature !== null && temperature < 95) flags.push('hypothermia');
    if (pulse !== null && pulse > 100) flags.push('tachycardia');
    if (pulse !== null && pulse < 50) flags.push('bradycardia');
    if (spo2 !== null && spo2 < 94) flags.push('low_spo2');
    if (systolic !== null && systolic < 90) flags.push('hypotension');
    if (systolic !== null && systolic >= 160) flags.push('hypertension');
    return flags;
  }

  private orderView(order: MockOrder) {
    const { admissionId: _admissionId, records: _records, ...rest } = order;
    return { ...rest, doctorName: 'Dr. Nusrat Jahan' };
  }

  private chartRow(order: MockOrder, day: string) {
    const due: string[] = [];
    if (order.status !== 'stopped') {
      if (order.schedule === 'times') due.push(...order.times.map((time) => at(day, time)));
      if (order.schedule === 'once' && toDay(new Date(order.startAt)) === day) due.push(order.startAt);
      if (order.schedule === 'interval') {
        for (let time = new Date(order.startAt).getTime(); toDay(new Date(time)) <= day;) {
          if (toDay(new Date(time)) === day) due.push(new Date(time).toISOString());
          time += order.intervalHours! * 3_600_000;
        }
      }
    }
    return {
      ...this.orderView(order),
      slots: due.map((dueAt) => {
        const record = order.records.find((row) => row.dueAt === dueAt) ?? null;
        const state = record ? record.outcome : new Date(dueAt) < new Date() ? 'overdue' : 'due';
        return { dueAt, state, record };
      }),
      doses: order.records.filter(
        (row) => row.dueAt === null && row.givenAt && toDay(new Date(row.givenAt)) === day,
      ),
    };
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1\/clinical/, '');
    const method = request.method();
    this.api.calls.push(`${method} /clinical${path}`);
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

    const roundMatch = path.match(/^\/observation-rounds(?:\/([^/]+))?$/);
    if (roundMatch) {
      const id = roundMatch[1];
      if (method === 'GET' && !id) return json(200, this.rounds);
      if (method === 'POST') {
        const created = {
          id: uuid(this.serial++),
          isActive: true,
          ...body(),
          version: 1,
          createdAt: NOW,
          updatedAt: NOW,
        };
        this.rounds.push(created);
        return json(201, created);
      }
      const row = this.rounds.find((candidate) => candidate['id'] === id);
      if (!row) return problem(404, 'not_found', 'Not found');
      if (method === 'GET') return json(200, row);
      if (method === 'PATCH') return (Object.assign(row, body()), json(200, row));
      if (method === 'DELETE') return (this.rounds.splice(this.rounds.indexOf(row), 1), json(204));
    }

    if (method === 'GET' && path === '/observation-board') {
      const day = url.searchParams.get('day') ?? toDay(new Date());
      const rounds = this.activeRounds();
      const patients = this.stays
        .filter((stay) => stay.status === 'admitted')
        .map((stay) => {
          const readings = this.observations.filter(
            (row) => row.admissionId === stay.id && !row.struckAt && toDay(new Date(row.takenAt)) === day,
          );
          const last = readings.at(-1) ?? null;
          return {
            admissionId: stay.id,
            admissionNumber: stay.number,
            patientName: stay.patientName,
            uhid: stay.uhid,
            wardName: stay.wardName,
            bedCode: stay.bedCode,
            rounds: rounds.map((round) =>
              readings.some((row) => row.roundName === round['name']) ? 'done' : 'due',
            ),
            lastAt: last?.takenAt ?? null,
            lastFlags: last?.flags ?? [],
          };
        });
      return json(200, {
        day,
        rounds: rounds.map(({ id, name, startTime, endTime }) => ({ id, name, startTime, endTime })),
        patients,
      });
    }

    if (method === 'GET' && path === '/medicines') {
      const q = url.searchParams.get('q')?.toLowerCase() ?? '';
      const items = this.medicines.filter((row) =>
        `${row.name} ${row.genericName}`.toLowerCase().includes(q),
      );
      return json(200, { items });
    }

    const strikeMatch = path.match(/^\/observations\/([^/]+)\/strike$/);
    if (method === 'POST' && strikeMatch) {
      const row = this.observations.find((candidate) => candidate.id === strikeMatch[1]);
      if (!row) return problem(404, 'observation_not_found', 'No such observation');
      if (row.struckAt) return problem(409, 'observation_struck', 'Already struck through');
      Object.assign(row, { struckAt: new Date().toISOString(), struckReason: body()['reason'] });
      return json(204);
    }

    const orderMatch = path.match(/^\/orders\/([^/]+)\/(hold|resume|stop|doses)$/);
    if (method === 'POST' && orderMatch) {
      const order = this.orders.find((candidate) => candidate.id === orderMatch[1]);
      if (!order) return problem(404, 'order_not_found', 'No such order');
      const input = body();
      if (orderMatch[2] === 'doses') {
        const dueAt = (input['dueAt'] as string | null) ?? null;
        if (dueAt && order.records.some((row) => row.dueAt === dueAt)) {
          return problem(409, 'dose_recorded', 'This dose is recorded already');
        }
        order.records.push({
          id: uuid(this.serial++),
          dueAt,
          outcome: input['outcome'] as 'given' | 'missed',
          givenAt: input['outcome'] === 'given' ? new Date().toISOString() : null,
          reason: (input['reason'] as string | null) ?? null,
        });
        return json(201, { id: order.records.at(-1)!.id });
      }
      if (input['version'] !== order.version) return problem(409, 'stale_order', 'The order changed');
      order.status = orderMatch[2] === 'hold' ? 'held' : orderMatch[2] === 'resume' ? 'active' : 'stopped';
      order.version += 1;
      return json(200, { version: order.version });
    }

    const stayMatch = path.match(/^\/admissions\/([^/]+)\/(observations|orders|care-orders|chart)$/);
    if (stayMatch) {
      const stay = this.stays.find((candidate) => candidate.id === stayMatch[1]);
      if (!stay) return problem(404, 'admission_not_found', 'No such admission');
      const what = stayMatch[2];
      if (method === 'GET' && what === 'observations') {
        const from = url.searchParams.get('from') ?? '0000-01-01';
        const to = url.searchParams.get('to') ?? '9999-12-31';
        const items = this.observations
          .filter((row) => row.admissionId === stay.id)
          .filter((row) => toDay(new Date(row.takenAt)) >= from && toDay(new Date(row.takenAt)) <= to)
          .map((row) => this.observationView(row));
        return json(200, { items });
      }
      if (method === 'POST' && what === 'observations') {
        if (stay.status !== 'admitted') return problem(409, 'admission_closed', 'The patient has left');
        const { takenAt, ...values } = body();
        const done = new Set(
          this.observations.filter((row) => row.admissionId === stay.id).map((row) => row.roundName),
        );
        const round = this.activeRounds().find((candidate) => !done.has(candidate['name'] as string));
        const row: MockObservation = {
          id: uuid(this.serial++),
          admissionId: stay.id,
          takenAt: (takenAt as string | null) ?? new Date().toISOString(),
          roundName: (round?.['name'] as string | undefined) ?? null,
          values,
          flags: this.flags(values),
          struckAt: null,
          struckReason: null,
        };
        this.observations.push(row);
        return json(201, { id: row.id, flags: row.flags });
      }
      if (method === 'GET' && what === 'orders') {
        return json(200, {
          items: this.orders.filter((row) => row.admissionId === stay.id).map((row) => this.orderView(row)),
        });
      }
      if (method === 'GET' && what === 'chart') {
        const day = url.searchParams.get('day') ?? toDay(new Date());
        const kind = url.searchParams.get('kind') ?? 'medicine';
        return json(200, {
          day,
          admission: { id: stay.id, number: stay.number, patientName: stay.patientName, status: stay.status },
          orders: this.orders
            .filter((row) => row.admissionId === stay.id && row.kind === kind)
            .map((row) => this.chartRow(row, day)),
        });
      }
      if (method === 'POST' && (what === 'orders' || what === 'care-orders')) {
        if (stay.status !== 'admitted') return problem(409, 'admission_closed', 'The patient has left');
        const input = body();
        const care = what === 'care-orders';
        const product = this.medicines.find((row) => row.id === input['productId']);
        const order: MockOrder = {
          id: uuid(this.serial++),
          admissionId: stay.id,
          kind: care ? 'care' : 'medicine',
          drugName: care ? (input['order'] as string) : (product?.name ?? (input['drugName'] as string)),
          dose: care ? ((input['instruction'] as string | null) ?? null) : (input['dose'] as string),
          route: care ? null : ((input['route'] as string | null) ?? null),
          schedule: input['schedule'] as MockOrder['schedule'],
          times: (input['times'] as string[]) ?? [],
          intervalHours: (input['intervalHours'] as number | null) ?? null,
          startAt: new Date().toISOString(),
          note: (input['note'] as string | null) || null,
          status: 'active',
          version: 1,
          records: [],
        };
        this.orders.push(order);
        return json(201, { id: order.id });
      }
    }

    return problem(404, 'not_found', `No nursing mock for ${method} /clinical${path}`);
  }
}

/** Grants the signed-in super-admin the nursing permissions and installs the mock. */
export async function mockNursing(page: Page, api: MockApi): Promise<NursingMock> {
  api.roles[0]!.permissions.push(...NURSING_PERMISSIONS);
  const nursing = new NursingMock(api);
  await nursing.install(page);
  return nursing;
}

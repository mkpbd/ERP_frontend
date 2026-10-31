import type { Page, Route } from '@playwright/test';
import type { MockApi } from './mock-api';

/**
 * In-memory stand-in for the backend's admissions, beds, the stay's account and visitor passes (`/hospital`), with
 * just enough rules for the screens: free beds, a final bill before discharge, reopening an unpaid bill, a pass limit.
 */

const uuid = (n: number) => `00000000-0000-4000-b000-${String(n).padStart(12, '0')}`;
const NOW = '2026-10-31T03:00:00.000Z';

export const IPD_PERMISSIONS = [
  'ipd:read',
  'ipd:admit',
  'ipd:bill',
  'ipd:manage',
  'patient:read',
  'opd:read',
];

interface MockBed {
  id: string;
  code: string;
  ward: string;
  status: 'available' | 'occupied' | 'housekeeping' | 'out_of_order';
  rate: number;
}

interface MockStay {
  id: string;
  number: string;
  patientId: string;
  bedId: string | null;
  lastBedId: string;
  status: 'admitted' | 'discharged' | 'cancelled';
  kind: 'emergency' | 'elective';
  reason: string | null;
  referredById: string | null;
  corporateClientId: string | null;
  dischargedAt: string | null;
  dischargeType: string | null;
  version: number;
  charges: { id: string; serviceName: string; amount: number; status: 'active' | 'cancelled' }[];
  held: number;
  bill: { id: string; number: string; net: number; paid: number; due: number; version: number } | null;
  passes: {
    id: string;
    number: string;
    visitorName: string;
    relation: string | null;
    status: 'active' | 'returned';
  }[];
}

export class IpdMock {
  readonly patients = [
    { id: uuid(1), uhid: 260101, fullName: 'Rahima Begum', sex: 'female', mobileNo: '01811000000' },
    { id: uuid(2), uhid: 260102, fullName: 'Abdul Karim', sex: 'male', mobileNo: '01711000000' },
  ];
  readonly doctors = [
    { id: uuid(11), name: 'Dr. Nusrat Jahan', degrees: 'FCPS', isConsultant: true },
    { id: uuid(12), name: 'Dr. Kamal Hossain', degrees: 'MBBS', isConsultant: false },
  ];
  readonly clients = [{ id: uuid(21), name: 'Acme Ltd' }];
  readonly services = [{ id: uuid(31), name: 'Dressing', rate: 300, sharePercent: null }];
  readonly beds: MockBed[] = [
    { id: uuid(41), code: 'W-1', ward: 'General ward', status: 'available', rate: 1200 },
    { id: uuid(42), code: 'W-2', ward: 'General ward', status: 'available', rate: 1200 },
    { id: uuid(43), code: 'ICU-1', ward: 'ICU', status: 'out_of_order', rate: 6000 },
  ];
  readonly stays: MockStay[] = [];
  readonly reports: string[] = [];
  private serial = 0;

  constructor(private readonly api: MockApi) {}

  async install(page: Page): Promise<void> {
    await page.route('**/api/v1/hospital/**', (route) => this.handle(route));
    await page.route('**/api/v1/reports/**', async (route) => {
      this.reports.push(new URL(route.request().url()).pathname.split('/').at(-2) ?? '');
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 mock' });
    });
  }

  private patient(stay: MockStay) {
    return this.patients.find((row) => row.id === stay.patientId)!;
  }

  private summary(stay: MockStay) {
    const bed = this.beds.find((row) => row.id === stay.bedId) ?? null;
    return {
      id: stay.id,
      number: stay.number,
      patientId: stay.patientId,
      uhid: this.patient(stay).uhid,
      patientName: this.patient(stay).fullName,
      admittedAt: NOW,
      kind: stay.kind,
      status: stay.status,
      dischargedAt: stay.dischargedAt,
      dischargeType: stay.dischargeType,
      bedCode: bed?.code ?? null,
      wardName: bed?.ward ?? null,
      doctorName: 'Dr. Nusrat Jahan',
      version: stay.version,
    };
  }

  private view(stay: MockStay) {
    const last = this.beds.find((row) => row.id === stay.lastBedId)!;
    return {
      ...this.summary(stay),
      sex: this.patient(stay).sex,
      dateOfBirth: '1990-01-01',
      mobileNo: this.patient(stay).mobileNo,
      reason: stay.reason,
      referredById: stay.referredById,
      referredByName: this.doctors.find((row) => row.id === stay.referredById)?.name ?? null,
      corporateClientId: stay.corporateClientId,
      corporateClientName: this.clients.find((row) => row.id === stay.corporateClientId)?.name ?? null,
      staffId: null,
      admissionFee: 500,
      dischargeNote: null,
      cancelReason: null,
      admittedBy: null,
      closedBy: null,
      stays: [
        {
          bedId: last.id,
          bedCode: last.code,
          wardName: last.ward,
          categoryName: 'General',
          fromAt: NOW,
          toAt: stay.status === 'admitted' ? null : stay.dischargedAt,
          dailyRate: last.rate,
          reason: 'Admitted',
        },
      ],
      doctors: [
        { doctorId: uuid(11), doctorName: 'Dr. Nusrat Jahan', role: 'primary', fromAt: NOW, toAt: null },
      ],
    };
  }

  private account(stay: MockStay) {
    const charged = stay.charges
      .filter((row) => row.status === 'active')
      .reduce((sum, row) => sum + row.amount, 0);
    const total = 500 + 1200 + charged;
    return {
      admissionId: stay.id,
      admissionNumber: stay.number,
      admissionStatus: stay.status,
      asOf: NOW.slice(0, 10),
      nights: 1,
      lines: [
        {
          head: 'admission',
          description: 'Admission fee',
          doctorId: null,
          doctorName: null,
          fromOn: null,
          toOn: null,
          qty: 1,
          rate: 500,
          amount: 500,
          serviceCharge: 0,
          shareAmount: 0,
        },
        {
          head: 'bed',
          description: 'Bed W-1',
          doctorId: null,
          doctorName: null,
          fromOn: null,
          toOn: null,
          qty: 1,
          rate: 1200,
          amount: 1200,
          serviceCharge: 0,
          shareAmount: 0,
        },
      ],
      gross: total,
      serviceCharge: 0,
      total,
      held: stay.bill ? 0 : stay.held,
      balance: total - stay.held,
      bill: stay.bill
        ? { ...stay.bill, billedOn: NOW.slice(0, 10), discount: 0, deposit: 0, collected: 0 }
        : null,
      charges: stay.charges.map((row) => ({
        ...row,
        serviceId: uuid(31),
        doctorId: null,
        doctorName: null,
        chargedOn: NOW.slice(0, 10),
        qty: 1,
        rate: row.amount,
        note: null,
        cancelReason: null,
      })),
      payments: stay.held
        ? [
            {
              number: 'AR-2026-00001',
              kind: 'advance',
              method: 'cash',
              reference: null,
              amount: stay.held,
              paidOn: NOW.slice(0, 10),
              billNumber: null,
            },
          ]
        : [],
      openIndents: 0,
    };
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

    if (method === 'GET' && path === '/patients') {
      const q = url.searchParams.get('q')?.toLowerCase() ?? '';
      const items = this.patients.filter((row) => !q || row.fullName.toLowerCase().includes(q));
      return json(200, { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 });
    }
    if (method === 'GET' && path === '/doctors') {
      const consultants = url.searchParams.get('isConsultant') === 'true';
      return json(
        200,
        this.doctors.filter((row) => !consultants || row.isConsultant),
      );
    }
    if (method === 'GET' && path === '/corporate-clients') return json(200, this.clients);
    if (method === 'GET' && path === '/services') return json(200, this.services);
    if (method === 'GET' && path === '/bed-board') {
      const wards = [...new Set(this.beds.map((bed) => bed.ward))].map((ward, index) => ({
        id: uuid(60 + index),
        name: ward,
        floor: null,
        beds: this.beds
          .filter((bed) => bed.ward === ward)
          .map((bed) => {
            const stay = this.stays.find((row) => row.bedId === bed.id && row.status === 'admitted');
            return {
              id: bed.id,
              code: bed.code,
              categoryName: 'General',
              isIntensive: false,
              status: bed.status,
              dailyRate: bed.rate,
              admission: stay
                ? {
                    id: stay.id,
                    number: stay.number,
                    patientName: this.patient(stay).fullName,
                    uhid: this.patient(stay).uhid,
                    since: NOW,
                    doctorName: null,
                  }
                : null,
            };
          }),
      }));
      const counts = { available: 0, occupied: 0, housekeeping: 0, out_of_order: 0 };
      for (const bed of this.beds) counts[bed.status] += 1;
      return json(200, { wards, counts });
    }
    const bedMatch = path.match(/^\/beds\/([^/]+)\/status$/);
    if (method === 'POST' && bedMatch) {
      this.beds.find((bed) => bed.id === bedMatch[1])!.status = body()['status'] as MockBed['status'];
      return json(204);
    }
    if (method === 'GET' && path === '/admissions') {
      const status = url.searchParams.get('status');
      const q = url.searchParams.get('q')?.toLowerCase();
      const items = this.stays
        .filter((stay) => !status || stay.status === status)
        .filter(
          (stay) =>
            !q ||
            this.patient(stay).fullName.toLowerCase().includes(q) ||
            stay.number.toLowerCase().includes(q),
        )
        .map((stay) => this.summary(stay));
      return json(200, { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 });
    }
    if (method === 'POST' && path === '/admissions') {
      const input = body();
      const bed = this.beds.find((row) => row.id === input['bedId']);
      if (!bed || bed.status !== 'available') return problem(409, 'bed_unavailable', 'The bed is taken');
      bed.status = 'occupied';
      const advance = (input['advance'] as { amount: number } | null)?.amount ?? 0;
      const stay: MockStay = {
        id: uuid(100 + this.stays.length),
        number: `IP-2026-0000${++this.serial}`,
        patientId: String(input['patientId']),
        bedId: bed.id,
        lastBedId: bed.id,
        status: 'admitted',
        kind: input['kind'] as MockStay['kind'],
        reason: (input['reason'] as string | null) ?? null,
        referredById: (input['referredById'] as string | null) ?? null,
        corporateClientId: (input['corporateClientId'] as string | null | undefined) ?? null,
        dischargedAt: null,
        dischargeType: null,
        version: 1,
        charges: [],
        held: advance,
        bill: null,
        passes: [],
      };
      this.stays.push(stay);
      return json(201, { id: stay.id, number: stay.number, receipt: advance ? 'AR-2026-00001' : null });
    }

    const passMatch = path.match(/^\/visitor-passes\/([^/]+)\/return$/);
    if (method === 'POST' && passMatch) {
      const pass = this.stays.flatMap((stay) => stay.passes).find((row) => row.id === passMatch[1])!;
      pass.status = 'returned';
      return json(204);
    }
    const billMatch = path.match(/^\/ipd-bills\/([^/]+)\/(cancel|collections)$/);
    if (method === 'POST' && billMatch) {
      const stay = this.stays.find((row) => row.bill?.id === billMatch[1])!;
      if (billMatch[2] === 'cancel') {
        stay.bill = null;
        return json(200, { held: stay.held });
      }
      const amount = Number(body()['amount']);
      stay.bill!.paid += amount;
      stay.bill!.due -= amount;
      stay.bill!.version += 1;
      return json(201, { number: 'IR-2026-00002', due: stay.bill!.due });
    }

    const match = path.match(/^\/admissions\/([^/]+)(?:\/([\w-]+))?(?:\/([^/]+)\/cancel)?$/);
    const stay = match ? this.stays.find((row) => row.id === match[1]) : undefined;
    if (!match || !stay) return problem(404, 'not_found', `No IPD mock for ${method} /hospital${path}`);
    const action = match[2] ?? '';
    const input = body();
    if (method === 'GET' && action === '') return json(200, this.view(stay));
    if (method === 'GET' && action === 'account') return json(200, this.account(stay));
    if (method === 'GET' && action === 'visitor-passes') {
      return json(200, {
        items: stay.passes.map((pass) => ({
          ...pass,
          admissionId: stay.id,
          mobileNo: null,
          issuedAt: NOW,
          issuedByName: 'Ada Admin',
          returnedAt: pass.status === 'returned' ? NOW : null,
          returnedByName: null,
          valid: pass.status === 'active' && stay.status === 'admitted',
        })),
      });
    }
    if (method === 'POST' && action === 'visitor-passes') {
      if (stay.passes.filter((pass) => pass.status === 'active').length >= 2) {
        return problem(409, 'pass_limit', '2 passes are in force for this patient; take one back first');
      }
      const pass = {
        id: uuid(500 + stay.passes.length),
        number: `VP-2026-0000${stay.passes.length + 1}`,
        visitorName: String(input['visitorName']),
        relation: (input['relation'] as string | null) ?? null,
        status: 'active' as const,
      };
      stay.passes.unshift(pass);
      return json(201, { id: pass.id, number: pass.number });
    }
    if (method === 'POST' && action === 'charges' && match[3]) {
      stay.charges.find((row) => row.id === match[3])!.status = 'cancelled';
      return json(204);
    }
    if (method === 'POST' && action === 'charges') {
      stay.charges.push({
        id: uuid(300 + stay.charges.length),
        serviceName: 'Dressing',
        amount: 300,
        status: 'active',
      });
      return json(201, { id: uuid(300), amount: 300 });
    }
    if (method === 'POST' && action === 'advances') {
      stay.held += Number(input['amount']);
      return json(201, { number: 'AR-2026-00002', held: stay.held });
    }
    if (method === 'POST' && action === 'final-bill') {
      const net = this.account(stay).total;
      const paid = (input['payment'] as { amount: number } | null)?.amount ?? 0;
      const due = net - stay.held - paid;
      stay.bill = { id: uuid(700), number: 'IB-2026-00001', net, paid, due, version: 1 };
      return json(201, {
        id: stay.bill.id,
        number: stay.bill.number,
        net,
        due,
        receipt: paid ? 'IR-2026-00001' : null,
      });
    }
    // Changes to the stay check the version read.
    if (input['version'] !== stay.version)
      return problem(409, 'stale_admission', 'The admission was changed by someone else');
    stay.version += 1;
    if (method === 'PUT' && action === '') {
      Object.assign(stay, {
        kind: input['kind'],
        reason: input['reason'],
        referredById: input['referredById'],
        corporateClientId: input['corporateClientId'],
      });
      return json(200, { version: stay.version, changed: ['kind'] });
    }
    if (action === 'discharge') {
      if (!stay.bill) return ((stay.version -= 1), problem(422, 'bill_needed', 'Make the final bill first'));
      Object.assign(stay, {
        status: 'discharged',
        dischargedAt: NOW,
        dischargeType: input['type'],
        bedId: null,
      });
      this.beds.find((bed) => bed.id === stay.lastBedId)!.status = 'housekeeping';
      return json(204);
    }
    if (action === 'reopen') {
      if (stay.bill && stay.bill.paid > 0) {
        stay.version -= 1;
        return problem(409, 'bill_paid', 'The final bill is paid; admit the patient again instead');
      }
      const bedId = (input['bedId'] as string | null) ?? stay.lastBedId;
      Object.assign(stay, {
        status: 'admitted',
        dischargedAt: null,
        dischargeType: null,
        bedId,
        lastBedId: bedId,
        bill: null,
      });
      this.beds.find((bed) => bed.id === bedId)!.status = 'occupied';
      return json(200, { version: stay.version, bill: 'IB-2026-00001', held: stay.held });
    }
    if (action === 'transfer') {
      this.beds.find((bed) => bed.id === stay.bedId)!.status = 'housekeeping';
      Object.assign(stay, { bedId: input['bedId'], lastBedId: input['bedId'] });
      this.beds.find((bed) => bed.id === input['bedId'])!.status = 'occupied';
      return json(204);
    }
    return json(204);
  }
}

/** Grants the signed-in super-admin the IPD permissions and installs the mock. */
export async function mockIpd(page: Page, api: MockApi): Promise<IpdMock> {
  api.roles[0]!.permissions.push(...IPD_PERMISSIONS);
  const ipd = new IpdMock(api);
  await ipd.install(page);
  return ipd;
}

import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { ApiError } from '../../../core/http/api-error';
import type { OtCase, OtCaseStatus } from '../models/ot.models';
import { OtApi } from '../services/ot-api.service';
import { OtCaseStore } from './ot-case.store';

const otCase = (status: OtCaseStatus, extra: Partial<OtCase> = {}): OtCase => ({
  id: 'c1',
  number: 'OT-2026-00001',
  status,
  admissionId: 'a1',
  admissionNumber: 'IPD-2026-00001',
  patientId: 'p1',
  uhid: 1001,
  patientName: 'Rahima Begum',
  operationName: 'Caesarean section',
  surgeonName: 'Dr. Surgeon',
  requestedFor: '2026-10-31',
  otRoomId: null,
  otRoomName: null,
  scheduledFrom: null,
  scheduledTo: null,
  operationId: 'op',
  otTypeId: null,
  otTypeName: null,
  anaesthesiaTypeId: null,
  anaesthesiaTypeName: null,
  surgeonId: 'd1',
  anaesthetistId: null,
  anaesthetistName: null,
  indication: null,
  team: [],
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
  charges: [],
  chargedTotal: 0,
  version: 4,
  ...extra,
});

const stable = () => TestBed.inject(ApplicationRef).whenStable();

describe('OtCaseStore', () => {
  function setup(current: OtCase, granted: readonly string[]) {
    const api = {
      get: vi.fn(() => of(current)),
      move: vi.fn(() => of({ version: current.version + 1 })),
      cancel: vi.fn(() => throwError(() => new ApiError(409, 'stale_ot_case', 'Changed meanwhile'))),
      charge: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({
      providers: [
        OtCaseStore,
        { provide: OtApi, useValue: api },
        { provide: Authorization, useValue: { can: (permission: string) => granted.includes(permission) } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'c1' })) } },
      ],
    });
    return { store: TestBed.inject(OtCaseStore), api };
  }

  it('offers only the steps the status and the permissions allow', async () => {
    const { store } = setup(otCase('scheduled'), ['ot:schedule', 'ot:note', 'ot:request']);
    await stable();
    expect([store.canStart(), store.canFinish(), store.canCancel(), store.canSchedule()]).toEqual([
      true,
      false,
      true,
      true,
    ]);
    // The note waits for the operation to start; charges need ipd:bill.
    expect([store.canWriteNote(), store.canCharge(), store.canChange()]).toEqual([false, false, true]);
  });

  it('lets the note be signed only once done with the procedure written, and not after', async () => {
    const done = setup(otCase('done', { procedureDone: 'LSCS' }), ['ot:note']);
    await stable();
    expect([done.store.canWriteNote(), done.store.canSign()]).toEqual([true, true]);

    TestBed.resetTestingModule();
    const signed = setup(otCase('done', { procedureDone: 'LSCS', noteSignedAt: '2026-10-31T10:00:00Z' }), [
      'ot:note',
    ]);
    await stable();
    expect([signed.store.canWriteNote(), signed.store.canSign()]).toEqual([false, false]);
  });

  it('sends the version it read and reloads after a change', async () => {
    const { store, api } = setup(otCase('scheduled'), ['ot:schedule']);
    await stable();
    await new Promise<void>((resolve) => store.start(null).subscribe({ complete: resolve }));
    expect(api.move).toHaveBeenCalledWith('c1', 4, 'start', null);
    await stable();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(store.pending()).toBeNull();
  });

  it('reloads on a conflict, so the page shows what changed meanwhile', async () => {
    const { store, api } = setup(otCase('requested'), ['ot:schedule']);
    await stable();
    const error = await new Promise<unknown>((resolve) =>
      store.cancel('No longer needed').subscribe({ error: resolve }),
    );
    expect((error as ApiError).status).toBe(409);
    await stable();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("charges the operation's stay with the operation named", async () => {
    const { store, api } = setup(otCase('in_progress'), ['ipd:bill']);
    await stable();
    await new Promise<void>((resolve) =>
      store.charge({ serviceId: 's1', doctorId: 'd1', qty: 1, note: null }).subscribe({ complete: resolve }),
    );
    expect(api.charge).toHaveBeenCalledWith('a1', {
      serviceId: 's1',
      doctorId: 'd1',
      qty: 1,
      note: null,
      otCaseId: 'c1',
    });
  });
});

import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { ApiError } from '../../../core/http/api-error';
import type { Admission } from '../models/ipd.models';
import { IpdApi } from '../services/ipd-api.service';
import { AdmissionStore } from './admission.store';

const admission = { id: 'a1', status: 'admitted', version: 3 } as unknown as Admission;
const stable = () => TestBed.inject(ApplicationRef).whenStable();

describe('AdmissionStore', () => {
  function setup(granted: readonly string[]) {
    const api = {
      admission: vi.fn(() => of(admission)),
      account: vi.fn(() => of({ bill: { id: 'b1' } })),
      passes: vi.fn(() => of([])),
      discharge: vi.fn((_id: string, _version: number) => of(undefined)),
      reopen: vi.fn((_id: string, _version: number) =>
        throwError(() => new ApiError(409, 'stale_admission', 'Changed')),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        AdmissionStore,
        { provide: IpdApi, useValue: api },
        { provide: Authorization, useValue: { can: (permission: string) => granted.includes(permission) } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'a1' })) } },
      ],
    });
    return { store: TestBed.inject(AdmissionStore), api };
  }

  it('loads the stay, its account and passes, and says what the user may do', async () => {
    const { store } = setup(['ipd:read', 'ipd:admit']);
    await stable();
    expect([store.admitted(), store.billed(), store.canAdmit(), store.canManage(), store.canBill()]).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('sends the version read with a change to the stay, and reloads after it and after a conflict', async () => {
    const { store, api } = setup(['ipd:read']);
    await stable();
    await new Promise<void>((resolve) =>
      store.change((id, version) => api.discharge(id, version)).subscribe({ complete: resolve }),
    );
    expect(api.discharge).toHaveBeenCalledWith('a1', 3);
    await stable();
    expect(api.admission).toHaveBeenCalledTimes(2);
    await new Promise<void>((resolve) =>
      store.change((id, version) => api.reopen(id, version)).subscribe({ error: () => resolve() }),
    );
    await stable();
    expect(api.admission).toHaveBeenCalledTimes(3);
    expect(store.pending()).toBe(false);
  });
});

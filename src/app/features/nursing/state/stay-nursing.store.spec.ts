import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { ApiError } from '../../../core/http/api-error';
import { scheduleText, toDay } from '../models/nursing.models';
import { NursingApi } from '../services/nursing-api.service';
import { StayNursingStore } from './stay-nursing.store';

const stable = () => TestBed.inject(ApplicationRef).whenStable();

describe('StayNursingStore', () => {
  function setup(granted: readonly string[], status = 'admitted') {
    const chart = (_id: string, day: string, _kind: string) =>
      of({ day, admission: { id: 'a1', number: 'IP-1', patientName: 'Rahima', status }, orders: [] });
    const api = {
      observations: vi.fn((_id: string, _from: string, _to: string) => of([])),
      chart: vi.fn(chart),
      orders: vi.fn((_id: string) => of([])),
      strike: vi.fn((_id: string, _reason: string) => of(undefined)),
      hold: vi.fn((_id: string, _version: number, _reason: string) =>
        throwError(() => new ApiError(409, 'stale_order', 'Changed')),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        StayNursingStore,
        { provide: NursingApi, useValue: api },
        { provide: Authorization, useValue: { can: (permission: string) => granted.includes(permission) } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'a1' })) } },
      ],
    });
    return { store: TestBed.inject(StayNursingStore), api };
  }

  it('reads the day of the stay and lets only the right people write while the patient is in', async () => {
    const { store, api } = setup(['emr:read', 'emr:write']);
    await stable();
    const today = toDay(new Date());
    expect(api.observations).toHaveBeenCalledWith('a1', today, today);
    expect(api.chart.mock.calls.map((call) => call[2])).toEqual(['medicine', 'care']);
    expect([store.admitted(), store.canWrite(), store.canOrder(), store.isToday()]).toEqual([
      true,
      true,
      false,
      true,
    ]);

    store.day.set('2026-01-02');
    await stable();
    expect(api.observations).toHaveBeenLastCalledWith('a1', '2026-01-02', '2026-01-02');
    expect(store.isToday()).toBe(false);
  });

  it('keeps a discharged stay read only', async () => {
    const { store } = setup(['emr:read', 'emr:write', 'emr:order'], 'discharged');
    await stable();
    expect([store.admitted(), store.canWrite(), store.canOrder()]).toEqual([false, false, false]);
  });

  it('reads everything again after a change and after a conflict', async () => {
    const { store, api } = setup(['emr:read', 'emr:write']);
    await stable();
    await new Promise<void>((resolve) =>
      store.act(() => api.strike('o1', 'Wrong patient')).subscribe({ complete: resolve }),
    );
    await stable();
    expect(api.observations).toHaveBeenCalledTimes(2);
    await new Promise<void>((resolve) =>
      store.act(() => api.hold('r1', 1, 'Nil by mouth')).subscribe({ error: () => resolve() }),
    );
    await stable();
    expect(api.observations).toHaveBeenCalledTimes(3);
    expect(store.pending()).toBe(false);
  });
});

describe('scheduleText', () => {
  it('says when an order is due', () => {
    expect(scheduleText({ schedule: 'times', times: ['08:00', '20:00'], intervalHours: null })).toBe(
      '08:00, 20:00',
    );
    expect(scheduleText({ schedule: 'interval', times: [], intervalHours: 6 })).toBe('Every 6 h');
    expect(scheduleText({ schedule: 'prn', times: [], intervalHours: null })).toBe('When needed');
  });
});

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-config';
import { toHttpParams } from '../../../core/http/http-params';
import type { Page } from '../../../shared/models/page';
import type {
  AdmissionOption,
  ChargeRequest,
  DoctorOption,
  NamedOption,
  OtBoard,
  OtCase,
  OtCaseQuery,
  OtCaseSummary,
  OtClinicalRequest,
  OtMasterRecord,
  OtNote,
  OtRoom,
  RequestOtRequest,
  ServiceOption,
} from '../models/ot.models';

/** The OT masters, by their path under `/hospital`. */
export type OtMaster = 'ot-rooms' | 'operations' | 'ot-types' | 'anaesthesia-types' | 'surgery-procedures';

type Versioned = Observable<{ version: number }>;

/** Data access for the operation theatre (`/hospital/ot-*`) and what choosing for it needs. */
@Injectable({ providedIn: 'root' })
export class OtApi {
  private readonly http = inject(HttpClient);
  private readonly hospital = `${inject(API_BASE_URL)}/hospital`;
  private readonly cases = `${this.hospital}/ot-cases`;

  board(day: string): Observable<OtBoard> {
    return this.http.get<OtBoard>(`${this.hospital}/ot-board`, { params: toHttpParams({ day }) });
  }

  list(query: OtCaseQuery): Observable<Page<OtCaseSummary>> {
    return this.http.get<Page<OtCaseSummary>>(this.cases, { params: toHttpParams({ ...query }) });
  }

  get(id: string): Observable<OtCase> {
    return this.http.get<OtCase>(this.caseUrl(id));
  }

  request(request: RequestOtRequest): Observable<{ id: string; number: string }> {
    return this.http.post<{ id: string; number: string }>(this.cases, request);
  }

  change(id: string, version: number, request: OtClinicalRequest): Versioned {
    return this.http.put<{ version: number }>(this.caseUrl(id), { version, ...request });
  }

  schedule(id: string, version: number, roomId: string, from: Date, to: Date): Versioned {
    return this.http.post<{ version: number }>(`${this.caseUrl(id)}/schedule`, {
      version,
      roomId,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  /** Start or finish; `at` left out is now. */
  move(id: string, version: number, step: 'start' | 'finish', at: Date | null): Versioned {
    return this.http.post<{ version: number }>(`${this.caseUrl(id)}/${step}`, {
      version,
      at: at ? at.toISOString() : null,
    });
  }

  cancel(id: string, version: number, reason: string): Versioned {
    return this.http.post<{ version: number }>(`${this.caseUrl(id)}/cancel`, { version, reason });
  }

  writeNote(id: string, version: number, note: OtNote): Versioned {
    return this.http.put<{ version: number }>(`${this.caseUrl(id)}/note`, { version, ...note });
  }

  signNote(id: string, version: number): Versioned {
    return this.http.post<{ version: number }>(`${this.caseUrl(id)}/note/sign`, { version });
  }

  /** An operation's charge is a charge of its stay (needs `ipd:bill`). */
  charge(admissionId: string, request: ChargeRequest): Observable<unknown> {
    return this.http.post(`${this.admissionUrl(admissionId)}/charges`, request);
  }

  cancelCharge(admissionId: string, chargeId: string, reason: string): Observable<void> {
    return this.http.post<void>(
      `${this.admissionUrl(admissionId)}/charges/${encodeURIComponent(chargeId)}/cancel`,
      { reason },
    );
  }

  masters(master: OtMaster): Observable<OtMasterRecord[]> {
    return this.http.get<OtMasterRecord[]>(`${this.hospital}/${master}`);
  }

  createMaster(master: OtMaster, body: Record<string, unknown>): Observable<OtMasterRecord> {
    return this.http.post<OtMasterRecord>(`${this.hospital}/${master}`, body);
  }

  updateMaster(master: OtMaster, id: string, body: Record<string, unknown>): Observable<OtMasterRecord> {
    return this.http.patch<OtMasterRecord>(`${this.hospital}/${master}/${encodeURIComponent(id)}`, body);
  }

  deleteMaster(master: OtMaster, id: string): Observable<void> {
    return this.http.delete<void>(`${this.hospital}/${master}/${encodeURIComponent(id)}`);
  }

  rooms(): Observable<OtRoom[]> {
    return this.http.get<OtRoom[]>(`${this.hospital}/ot-rooms`, { params: toHttpParams({ isActive: true }) });
  }

  /** Active operations, OT types and anaesthesia types, for the request form. */
  operations(): Observable<NamedOption[]> {
    return this.http.get<NamedOption[]>(`${this.hospital}/operations`, {
      params: toHttpParams({ isActive: true }),
    });
  }

  otTypes(): Observable<NamedOption[]> {
    return this.http.get<NamedOption[]>(`${this.hospital}/ot-types`);
  }

  anaesthesiaTypes(): Observable<NamedOption[]> {
    return this.http.get<NamedOption[]>(`${this.hospital}/anaesthesia-types`);
  }

  /** Admitted patients by name, UHID or admission number (needs `ipd:read`). */
  admitted(q: string): Observable<AdmissionOption[]> {
    return this.http
      .get<Page<AdmissionOption>>(`${this.hospital}/admissions`, {
        params: toHttpParams({ q, status: 'admitted', pageSize: 20 }),
      })
      .pipe(map((page) => [...page.items]));
  }

  /** Active doctors (needs `opd:read`). */
  doctors(): Observable<DoctorOption[]> {
    return this.http.get<DoctorOption[]>(`${this.hospital}/doctors`, {
      params: toHttpParams({ isActive: true }),
    });
  }

  /** Active inpatient services (needs `opd:read`). */
  services(): Observable<ServiceOption[]> {
    return this.http.get<ServiceOption[]>(`${this.hospital}/services`, {
      params: toHttpParams({ isIpd: true, isActive: true }),
    });
  }

  private caseUrl(id: string): string {
    return `${this.cases}/${encodeURIComponent(id)}`;
  }

  private admissionUrl(id: string): string {
    return `${this.hospital}/admissions/${encodeURIComponent(id)}`;
  }
}

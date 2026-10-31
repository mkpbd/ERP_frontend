import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-config';
import { toHttpParams } from '../../../core/http/http-params';
import type { Page } from '../../../shared/models/page';
import type {
  Admission,
  AdmissionQuery,
  AdmissionSummary,
  AdmitRequest,
  BedBoard,
  CorrectionRequest,
  DischargeType,
  IpdAccount,
  MoneyInput,
  NamedOption,
  PatientOption,
  VisitorPass,
} from '../models/ipd.models';

type Versioned = Observable<{ version: number }>;

/** Data access for admissions, beds, the stay's account and visitor passes (`/hospital`). */
@Injectable({ providedIn: 'root' })
export class IpdApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/hospital`;

  admissions(query: AdmissionQuery): Observable<Page<AdmissionSummary>> {
    return this.http.get<Page<AdmissionSummary>>(`${this.url}/admissions`, {
      params: toHttpParams({ ...query }),
    });
  }

  admission(id: string): Observable<Admission> {
    return this.http.get<Admission>(this.admissionUrl(id));
  }

  admit(request: AdmitRequest): Observable<{ id: string; number: string; receipt: string | null }> {
    return this.http.post<{ id: string; number: string; receipt: string | null }>(
      `${this.url}/admissions`,
      request,
    );
  }

  bedBoard(): Observable<BedBoard> {
    return this.http.get<BedBoard>(`${this.url}/bed-board`);
  }

  setBedStatus(bedId: string, status: 'available' | 'out_of_order'): Observable<void> {
    return this.http.post<void>(`${this.url}/beds/${encodeURIComponent(bedId)}/status`, { status });
  }

  transfer(id: string, version: number, bedId: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.admissionUrl(id)}/transfer`, { version, bedId, reason });
  }

  consultant(id: string, version: number, doctorId: string): Observable<void> {
    return this.http.post<void>(`${this.admissionUrl(id)}/consultant`, { version, doctorId });
  }

  additionalDoctors(id: string, version: number, doctorIds: readonly string[]): Observable<void> {
    return this.http.post<void>(`${this.admissionUrl(id)}/additional-doctors`, { version, doctorIds });
  }

  correct(id: string, version: number, correction: CorrectionRequest): Versioned {
    return this.http.put<{ version: number }>(this.admissionUrl(id), { version, ...correction });
  }

  discharge(id: string, version: number, type: DischargeType, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.admissionUrl(id)}/discharge`, { version, type, note });
  }

  cancel(id: string, version: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.admissionUrl(id)}/cancel`, { version, reason });
  }

  reopen(
    id: string,
    version: number,
    reason: string,
    bedId: string | null,
  ): Observable<{ bill: string | null; held: number }> {
    return this.http.post<{ bill: string | null; held: number }>(`${this.admissionUrl(id)}/reopen`, {
      version,
      reason,
      bedId,
    });
  }

  account(id: string): Observable<IpdAccount> {
    return this.http.get<IpdAccount>(`${this.admissionUrl(id)}/account`);
  }

  charge(
    id: string,
    request: { serviceId: string; doctorId: string | null; qty: number; note: string | null },
  ): Observable<unknown> {
    return this.http.post(`${this.admissionUrl(id)}/charges`, request);
  }

  cancelCharge(id: string, chargeId: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.admissionUrl(id)}/charges/${encodeURIComponent(chargeId)}/cancel`, {
      reason,
    });
  }

  advance(id: string, money: MoneyInput): Observable<{ number: string; held: number }> {
    return this.http.post<{ number: string; held: number }>(`${this.admissionUrl(id)}/advances`, money);
  }

  refund(id: string, money: MoneyInput): Observable<{ number: string; held: number }> {
    return this.http.post<{ number: string; held: number }>(`${this.admissionUrl(id)}/refunds`, money);
  }

  finalBill(
    id: string,
    request: { discount: number | null; discountReason: string | null; payment: MoneyInput | null },
  ): Observable<{ id: string; number: string; net: number; due: number; receipt: string | null }> {
    return this.http.post<{ id: string; number: string; net: number; due: number; receipt: string | null }>(
      `${this.admissionUrl(id)}/final-bill`,
      request,
    );
  }

  cancelBill(billId: string, version: number, reason: string): Observable<{ held: number }> {
    return this.http.post<{ held: number }>(`${this.url}/ipd-bills/${encodeURIComponent(billId)}/cancel`, {
      version,
      reason,
    });
  }

  collect(billId: string, version: number, money: MoneyInput): Observable<{ number: string; due: number }> {
    return this.http.post<{ number: string; due: number }>(
      `${this.url}/ipd-bills/${encodeURIComponent(billId)}/collections`,
      { version, ...money },
    );
  }

  passes(id: string): Observable<VisitorPass[]> {
    return this.http
      .get<{ items: VisitorPass[] }>(`${this.admissionUrl(id)}/visitor-passes`)
      .pipe(map((response) => response.items));
  }

  issuePass(
    id: string,
    visitor: { visitorName: string; relation: string | null; mobileNo: string | null },
  ): Observable<{ id: string; number: string }> {
    return this.http.post<{ id: string; number: string }>(`${this.admissionUrl(id)}/visitor-passes`, visitor);
  }

  returnPass(passId: string): Observable<void> {
    return this.http.post<void>(`${this.url}/visitor-passes/${encodeURIComponent(passId)}/return`, null);
  }

  /** Patients by name, UHID or mobile (needs `patient:read`). */
  patients(q: string): Observable<PatientOption[]> {
    return this.http
      .get<Page<PatientOption>>(`${this.url}/patients`, { params: toHttpParams({ q, pageSize: 20 }) })
      .pipe(map((page) => [...page.items]));
  }

  /** Active doctors; consultants only when asked (needs `opd:read`). */
  doctors(consultants = false): Observable<(NamedOption & { degrees: string | null })[]> {
    return this.http.get<(NamedOption & { degrees: string | null })[]>(`${this.url}/doctors`, {
      params: toHttpParams({ isActive: true, isConsultant: consultants ? true : undefined }),
    });
  }

  corporateClients(): Observable<NamedOption[]> {
    return this.http.get<NamedOption[]>(`${this.url}/corporate-clients`, {
      params: toHttpParams({ isActive: true }),
    });
  }

  services(): Observable<(NamedOption & { rate: number; sharePercent: number | null })[]> {
    return this.http.get<(NamedOption & { rate: number; sharePercent: number | null })[]>(
      `${this.url}/services`,
      {
        params: toHttpParams({ isIpd: true, isActive: true }),
      },
    );
  }

  private admissionUrl(id: string): string {
    return `${this.url}/admissions/${encodeURIComponent(id)}`;
  }
}

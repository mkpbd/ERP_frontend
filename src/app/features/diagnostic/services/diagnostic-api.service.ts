import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-config';
import { toHttpParams } from '../../../core/http/http-params';
import type { Page } from '../../../shared/models/page';
import type {
  AppointmentBoard,
  BillRequest,
  BookAppointmentRequest,
  BookCollectionRequest,
  CollectionArea,
  CollectionBoard,
  Department,
  DiagnosticPolicy,
  NamedOption,
  PatientOption,
  TestOption,
  WindowDay,
} from '../models/diagnostic.models';

/** Data access for test appointments and home collections (`/hospital/test-appointments`, `/hospital/home-*`). */
@Injectable({ providedIn: 'root' })
export class DiagnosticApi {
  private readonly http = inject(HttpClient);
  private readonly hospital = `${inject(API_BASE_URL)}/hospital`;

  appointments(query: {
    from: string;
    to?: string;
    departmentId?: string | null;
  }): Observable<AppointmentBoard> {
    return this.http.get<AppointmentBoard>(`${this.hospital}/test-appointments`, {
      params: toHttpParams({ from: query.from, to: query.to, departmentId: query.departmentId ?? undefined }),
    });
  }

  /** The windows of a day with their places (for a department: its own and any department's). */
  availability(date: string, departmentId: string | null): Observable<WindowDay[]> {
    return this.http
      .get<{ items: WindowDay[] }>(`${this.hospital}/test-appointment-availability`, {
        params: toHttpParams({ date, departmentId: departmentId ?? undefined }),
      })
      .pipe(map((response) => response.items));
  }

  bookAppointment(
    request: BookAppointmentRequest,
  ): Observable<{ id: string; number: string; serial: number }> {
    return this.http.post<{ id: string; number: string; serial: number }>(
      `${this.hospital}/test-appointments`,
      request,
    );
  }

  noShow(id: string, version: number): Observable<void> {
    return this.http.post<void>(`${this.appointmentUrl(id)}/no-show`, { version });
  }

  cancelAppointment(id: string, version: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.appointmentUrl(id)}/cancel`, { version, reason });
  }

  collections(query: {
    from: string;
    to?: string;
    areaId?: string | null;
    collectorId?: string | null;
  }): Observable<CollectionBoard> {
    return this.http.get<CollectionBoard>(`${this.hospital}/home-collections`, {
      params: toHttpParams({
        from: query.from,
        to: query.to,
        areaId: query.areaId ?? undefined,
        collectorId: query.collectorId ?? undefined,
      }),
    });
  }

  bookCollection(request: BookCollectionRequest): Observable<{ id: string; number: string }> {
    return this.http.post<{ id: string; number: string }>(`${this.hospital}/home-collections`, request);
  }

  assign(id: string, version: number, collectorId: string): Observable<void> {
    return this.http.post<void>(`${this.collectionUrl(id)}/assign`, { version, collectorId });
  }

  collected(id: string, version: number, note: string | null): Observable<void> {
    return this.http.post<void>(`${this.collectionUrl(id)}/collected`, { version, note });
  }

  cancelCollection(id: string, version: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.collectionUrl(id)}/cancel`, { version, reason });
  }

  /** The active users who take samples at homes (needs `diag:book`). */
  collectors(): Observable<NamedOption[]> {
    return this.http
      .get<{ items: { id: string; displayName: string }[] }>(`${this.hospital}/home-collectors`)
      .pipe(map((response) => response.items.map((user) => ({ id: user.id, label: user.displayName }))));
  }

  areas(activeOnly = true): Observable<CollectionArea[]> {
    return this.http.get<CollectionArea[]>(`${this.hospital}/home-collection-areas`, {
      params: toHttpParams({ isActive: activeOnly ? true : undefined }),
    });
  }

  collectionWindows(): Observable<NamedOption[]> {
    return this.http
      .get<{ id: string; label: string }[]>(`${this.hospital}/home-collection-windows`, {
        params: toHttpParams({ isActive: true }),
      })
      .pipe(map((rows) => rows.map((row) => ({ id: row.id, label: row.label }))));
  }

  departments(): Observable<Department[]> {
    return this.http.get<Department[]>(`${this.hospital}/diagnostic-departments`);
  }

  /** Active tests by name, short name or code. */
  tests(q: string): Observable<TestOption[]> {
    return this.http.get<TestOption[]>(`${this.hospital}/diagnostic-tests`, {
      params: toHttpParams({ q: q || undefined, isActive: true }),
    });
  }

  /** Registered patients by name, UHID or mobile (needs `patient:read`). */
  patients(q: string): Observable<PatientOption[]> {
    return this.http
      .get<Page<PatientOption>>(`${this.hospital}/patients`, { params: toHttpParams({ q, pageSize: 20 }) })
      .pipe(map((page) => [...page.items]));
  }

  policy(): Observable<DiagnosticPolicy> {
    return this.http.get<DiagnosticPolicy>(`${this.hospital}/diagnostic-policy`);
  }

  setPolicy(policy: DiagnosticPolicy): Observable<void> {
    return this.http.put<void>(`${this.hospital}/diagnostic-policy`, policy);
  }

  /** The booking's bill (needs `diag:bill`): the booking is then billed with it. */
  bill(request: BillRequest): Observable<{ id: string; number: string; net: number; due: number }> {
    return this.http.post<{ id: string; number: string; net: number; due: number }>(
      `${this.hospital}/diagnostic-bills`,
      request,
    );
  }

  private appointmentUrl(id: string): string {
    return `${this.hospital}/test-appointments/${encodeURIComponent(id)}`;
  }

  private collectionUrl(id: string): string {
    return `${this.hospital}/home-collections/${encodeURIComponent(id)}`;
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-config';
import { toHttpParams } from '../../../core/http/http-params';
import type { Page } from '../../../shared/models/page';
import type {
  Antibiotic,
  CollectableOrder,
  CultureMessage,
  CultureRequest,
  LabResult,
  LabTest,
  NamedRecord,
  ReportForm,
  ReportTemplate,
  ResultQuery,
  ResultSummary,
  Sample,
  SampleQuery,
  SampleSummary,
} from '../models/lab.models';

/** Data access for the laboratory (`/lab`): samples, results in their three forms, test forms and the masters. */
@Injectable({ providedIn: 'root' })
export class LabApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/lab`;

  results(query: ResultQuery): Observable<Page<ResultSummary>> {
    return this.http.get<Page<ResultSummary>>(`${this.url}/results`, { params: toHttpParams({ ...query }) });
  }

  result(id: string): Observable<LabResult> {
    return this.http.get<LabResult>(this.resultUrl(id));
  }

  enterValues(
    id: string,
    version: number,
    values: readonly { parameterId: string; value: string | null }[],
    comment: string | null,
  ): Observable<void> {
    return this.http.put<void>(this.resultUrl(id), { version, values, comment });
  }

  enterCulture(id: string, version: number, request: CultureRequest): Observable<void> {
    return this.http.put<void>(`${this.resultUrl(id)}/culture`, { version, ...request });
  }

  enterText(id: string, version: number, narrative: string, comment: string | null): Observable<void> {
    return this.http.put<void>(`${this.resultUrl(id)}/text`, { version, narrative, comment });
  }

  verify(id: string, version: number): Observable<void> {
    return this.http.post<void>(`${this.resultUrl(id)}/verify`, { version });
  }

  unverify(id: string, version: number): Observable<void> {
    return this.http.post<void>(`${this.resultUrl(id)}/unverify`, { version });
  }

  samples(query: SampleQuery): Observable<Page<SampleSummary>> {
    return this.http.get<Page<SampleSummary>>(`${this.url}/samples`, { params: toHttpParams({ ...query }) });
  }

  sample(id: string): Observable<Sample> {
    return this.http.get<Sample>(this.sampleUrl(id));
  }

  /** The bill by its number, with what each lab department can collect. */
  order(number: string): Observable<CollectableOrder> {
    return this.http.get<CollectableOrder>(`${this.url}/orders/${encodeURIComponent(number)}`);
  }

  collect(
    billId: string,
    departmentId: string,
  ): Observable<{ id: string; labNumber: string; tests: number }> {
    return this.http.post<{ id: string; labNumber: string; tests: number }>(`${this.url}/samples`, {
      billId,
      departmentId,
    });
  }

  receive(id: string, version: number): Observable<unknown> {
    return this.http.post(`${this.sampleUrl(id)}/receive`, { version });
  }

  reject(id: string, version: number, reason: string): Observable<unknown> {
    return this.http.post(`${this.sampleUrl(id)}/reject`, { version, reason });
  }

  deliver(id: string, version: number, to: string): Observable<unknown> {
    return this.http.post(`${this.sampleUrl(id)}/deliver`, { version, to });
  }

  tests(q: string): Observable<LabTest[]> {
    return this.http
      .get<{ items: LabTest[] }>(`${this.url}/tests`, { params: toHttpParams({ q }) })
      .pipe(map((response) => response.items));
  }

  setForm(testId: string, form: ReportForm): Observable<void> {
    return this.http.put<void>(`${this.url}/tests/${encodeURIComponent(testId)}/form`, { form });
  }

  antibiotics(): Observable<Antibiotic[]> {
    return this.http.get<Antibiotic[]>(`${this.url}/antibiotics`, {
      params: toHttpParams({ isActive: true }),
    });
  }

  organisms(): Observable<NamedRecord[]> {
    return this.http.get<NamedRecord[]>(`${this.url}/organisms`, {
      params: toHttpParams({ isActive: true }),
    });
  }

  growthTypes(): Observable<NamedRecord[]> {
    return this.http.get<NamedRecord[]>(`${this.url}/growth-types`);
  }

  cultureMessages(): Observable<CultureMessage[]> {
    return this.http.get<CultureMessage[]>(`${this.url}/culture-messages`);
  }

  reportTemplates(): Observable<ReportTemplate[]> {
    return this.http.get<ReportTemplate[]>(`${this.url}/report-templates`);
  }

  private resultUrl(id: string): string {
    return `${this.url}/results/${encodeURIComponent(id)}`;
  }

  private sampleUrl(id: string): string {
    return `${this.url}/samples/${encodeURIComponent(id)}`;
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-config';
import { toHttpParams } from '../../core/http/http-params';
import type { RecordRow } from '../models/record-master';

/** Data access for the backend's simple record endpoints (masters): list, create, edit, delete. */
@Injectable({ providedIn: 'root' })
export class RecordsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list<T extends RecordRow = RecordRow>(
    path: string,
    filter: Readonly<Record<string, string | boolean | undefined>> = {},
  ): Observable<T[]> {
    return this.http.get<T[]>(this.url(path), { params: toHttpParams({ ...filter }) });
  }

  get<T extends RecordRow = RecordRow>(path: string, id: string): Observable<T> {
    return this.http.get<T>(`${this.url(path)}/${encodeURIComponent(id)}`);
  }

  create(path: string, body: Record<string, unknown>): Observable<RecordRow> {
    return this.http.post<RecordRow>(this.url(path), body);
  }

  update(path: string, id: string, body: Record<string, unknown>): Observable<RecordRow> {
    return this.http.patch<RecordRow>(`${this.url(path)}/${encodeURIComponent(id)}`, body);
  }

  remove(path: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.url(path)}/${encodeURIComponent(id)}`);
  }

  private url(path: string): string {
    return `${this.baseUrl}/${path}`;
  }
}

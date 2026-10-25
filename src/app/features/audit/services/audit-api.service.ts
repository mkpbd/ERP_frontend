import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-config';
import { toHttpParams } from '../../../core/http/http-params';
import type { Page } from '../../../shared/models/page';
import type { AuditLogEntry, AuditLogQuery } from '../models/audit.models';

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/audit-logs`;

  list(query: AuditLogQuery): Observable<Page<AuditLogEntry>> {
    return this.http.get<Page<AuditLogEntry>>(this.url, { params: toHttpParams({ ...query }) });
  }
}

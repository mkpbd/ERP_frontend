import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-config';
import { toHttpParams } from '../../../core/http/http-params';
import type { Page } from '../../../shared/models/page';

export interface RecentActivity {
  readonly id: string;
  readonly occurredAt: string;
  readonly action: string;
  readonly resourceType: string;
  readonly outcome: 'success' | 'failure' | 'denied';
}

/**
 * Read-only summaries for the dashboard. Deliberately its own service instead of importing other
 * features' services, so features stay independent; it only asks for the small projections it shows.
 */
@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Uses the page envelope's `total` with a one-item page. */
  countUsers(status?: 'active' | 'deactivated'): Observable<number> {
    return this.http
      .get<Page<unknown>>(`${this.baseUrl}/users`, { params: toHttpParams({ page: 1, pageSize: 1, status }) })
      .pipe(map((page) => page.total));
  }

  countRoles(): Observable<number> {
    return this.http.get<unknown[]>(`${this.baseUrl}/roles`).pipe(map((roles) => roles.length));
  }

  recentActivity(limit = 8): Observable<readonly RecentActivity[]> {
    return this.http
      .get<Page<RecentActivity>>(`${this.baseUrl}/audit-logs`, {
        params: toHttpParams({ page: 1, pageSize: limit }),
      })
      .pipe(map((page) => page.items));
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';

export interface PermissionDefinition {
  readonly key: string;
  readonly description: string;
}

/** `GET /permissions` (needs `permissions:read`). Shared by the roles and permissions features. */
@Injectable({ providedIn: 'root' })
export class PermissionCatalogApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(): Observable<PermissionDefinition[]> {
    return this.http.get<PermissionDefinition[]>(`${this.baseUrl}/permissions`);
  }
}

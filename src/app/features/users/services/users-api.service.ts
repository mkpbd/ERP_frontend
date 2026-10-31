import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-config';
import { toHttpParams } from '../../../core/http/http-params';
import type { Page } from '../../../shared/models/page';
import type {
  CreateUserRequest,
  EffectivePermissions,
  RoleOption,
  UpdateUserRequest,
  User,
  UserListQuery,
  UserRole,
} from '../models/user.models';

/** Data access for `/users` and the user-role assignment endpoints. */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/users`;

  list(query: UserListQuery): Observable<Page<User>> {
    return this.http.get<Page<User>>(this.url, { params: toHttpParams({ ...query }) });
  }

  get(id: string): Observable<User> {
    return this.http.get<User>(`${this.url}/${encodeURIComponent(id)}`);
  }

  create(request: CreateUserRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.url, request);
  }

  update(id: string, request: UpdateUserRequest): Observable<void> {
    return this.http.patch<void>(`${this.url}/${encodeURIComponent(id)}`, request);
  }

  deactivate(id: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${encodeURIComponent(id)}/deactivate`, null);
  }

  activate(id: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${encodeURIComponent(id)}/activate`, null);
  }

  /** When the account stops signing in; null clears it (needs users:deactivate). */
  setExpiry(id: string, expiresAt: string | null): Observable<void> {
    return this.http.put<void>(`${this.url}/${encodeURIComponent(id)}/expiry`, { expiresAt });
  }

  revokeSessions(id: string): Observable<{ revoked: number }> {
    return this.http.delete<{ revoked: number }>(`${this.url}/${encodeURIComponent(id)}/sessions`);
  }

  roles(id: string): Observable<UserRole[]> {
    return this.http.get<UserRole[]>(`${this.url}/${encodeURIComponent(id)}/roles`);
  }

  assignRole(id: string, roleId: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${encodeURIComponent(id)}/roles`, { roleId });
  }

  removeRole(id: string, roleId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.url}/${encodeURIComponent(id)}/roles/${encodeURIComponent(roleId)}`,
    );
  }

  effectivePermissions(id: string): Observable<EffectivePermissions> {
    return this.http.get<EffectivePermissions>(`${this.url}/${encodeURIComponent(id)}/permissions`);
  }

  /** Roles to choose from when assigning (needs `roles:read`). */
  roleOptions(): Observable<RoleOption[]> {
    return this.http.get<RoleOption[]>(`${this.baseUrl}/roles`);
  }
}

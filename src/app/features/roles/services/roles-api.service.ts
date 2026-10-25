import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { concat, map, Observable, of, toArray } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-config';
import { CreateRoleRequest, diffPermissions, Role, UpdateRoleRequest } from '../models/role.models';

/** Data access for `/roles` and role-permission grants. */
@Injectable({ providedIn: 'root' })
export class RolesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/roles`;

  list(): Observable<Role[]> {
    return this.http.get<Role[]>(this.url);
  }

  get(id: string): Observable<Role> {
    return this.http.get<Role>(`${this.url}/${encodeURIComponent(id)}`);
  }

  create(request: CreateRoleRequest): Observable<Role> {
    return this.http.post<Role>(this.url, request);
  }

  update(id: string, request: UpdateRoleRequest): Observable<Role> {
    return this.http.patch<Role>(`${this.url}/${encodeURIComponent(id)}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }

  grantPermissions(id: string, permissions: readonly string[]): Observable<{ granted: string[] }> {
    return this.http.post<{ granted: string[] }>(`${this.url}/${encodeURIComponent(id)}/permissions`, {
      permissions,
    });
  }

  revokePermission(id: string, permission: string): Observable<void> {
    return this.http.delete<void>(
      `${this.url}/${encodeURIComponent(id)}/permissions/${encodeURIComponent(permission)}`,
    );
  }

  /**
   * Applies a permission change as one grant call plus one revoke per removed key, sequentially, so a
   * failure stops the remaining calls. Not atomic: the caller reloads the role afterwards either way.
   */
  setPermissions(id: string, current: readonly string[], desired: readonly string[]): Observable<void> {
    const { grant, revoke } = diffPermissions(current, desired);
    const calls: Observable<unknown>[] = [
      ...(grant.length ? [this.grantPermissions(id, grant)] : []),
      ...revoke.map((key) => this.revokePermission(id, key)),
    ];
    if (calls.length === 0) return of(undefined);
    return concat(...calls).pipe(
      toArray(),
      map(() => undefined),
    );
  }
}

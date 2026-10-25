import { computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, map, Observable, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Authorization } from '../../../core/authorization/authorization.service';
import { PermissionCatalogApi } from '../../../core/authorization/permission-catalog.api';
import { toApiError } from '../../../core/http/api-error';
import { diffPermissions, type UpdateRoleRequest } from '../models/role.models';
import { RolesApi } from '../services/roles-api.service';

export type RoleAction = 'update' | 'permissions' | 'delete';

/** State for one role's page, provided by that page. */
@Injectable()
export class RoleDetailStore {
  private readonly api = inject(RolesApi);
  private readonly catalogApi = inject(PermissionCatalogApi);
  private readonly authorization = inject(Authorization);
  private readonly auth = inject(AuthService);

  readonly roleId = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')), {
    requireSync: true,
  });

  private readonly roleResource = rxResource({
    params: () => this.roleId() || undefined,
    stream: ({ params }) => this.api.get(params),
  });
  private readonly catalogResource = rxResource({
    params: () => (this.authorization.can('permissions:read') ? true : undefined),
    stream: () => this.catalogApi.list(),
  });

  readonly role = computed(() => (this.roleResource.hasValue() ? this.roleResource.value() : null));
  readonly loading = this.roleResource.isLoading;
  readonly error = computed(() => {
    const error = this.roleResource.error();
    return error ? toApiError(error) : null;
  });
  readonly catalog = computed(() => (this.catalogResource.hasValue() ? this.catalogResource.value() : []));

  readonly canEdit = computed(
    () => !!this.role() && !this.role()?.isSystem && this.authorization.can('roles:update'),
  );
  readonly canEditPermissions = computed(
    () =>
      !!this.role() &&
      !this.role()?.isSystem &&
      this.authorization.can('permissions:assign') &&
      this.catalog().length > 0,
  );
  readonly canDelete = computed(
    () => !!this.role() && !this.role()?.isSystem && this.authorization.can('roles:delete'),
  );

  /** Working copy of the permission selection; resets whenever the role is (re)loaded. */
  readonly selectedPermissions = linkedSignal<readonly string[]>(() => this.role()?.permissions ?? []);
  readonly permissionChanges = computed(() =>
    diffPermissions(this.role()?.permissions ?? [], this.selectedPermissions()),
  );
  readonly permissionsDirty = computed(
    () => this.permissionChanges().grant.length > 0 || this.permissionChanges().revoke.length > 0,
  );

  readonly pending = signal<RoleAction | null>(null);

  reload(): void {
    this.roleResource.reload();
  }

  update(request: UpdateRoleRequest): Observable<void> {
    this.pending.set('update');
    return this.api.update(this.roleId(), request).pipe(
      tap((role) => this.roleResource.set(role)),
      map(() => undefined),
      finalize(() => this.pending.set(null)),
    );
  }

  savePermissions(): Observable<void> {
    const role = this.role();
    if (!role) throw new Error('Role not loaded');
    this.pending.set('permissions');
    return this.api.setPermissions(role.id, role.permissions, this.selectedPermissions()).pipe(
      // Your own permissions may have changed if you hold this role.
      switchMap(() => this.auth.reloadUser()),
      map(() => undefined),
      finalize(() => {
        this.pending.set(null);
        // Reload in every case: a partial failure may have applied some of the changes.
        this.roleResource.reload();
      }),
    );
  }

  delete(): Observable<void> {
    this.pending.set('delete');
    return this.api.delete(this.roleId()).pipe(finalize(() => this.pending.set(null)));
  }
}

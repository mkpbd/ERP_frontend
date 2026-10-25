import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Authorization } from '../../../core/authorization/authorization.service';
import { PermissionCatalogApi } from '../../../core/authorization/permission-catalog.api';
import { toApiError } from '../../../core/http/api-error';
import { RolesApi } from '../services/roles-api.service';

/** Roles list page state. The backend returns every role at once, so filtering happens client-side. */
@Injectable()
export class RolesStore {
  private readonly api = inject(RolesApi);
  private readonly catalogApi = inject(PermissionCatalogApi);
  private readonly authorization = inject(Authorization);

  private readonly rolesResource = rxResource({ stream: () => this.api.list() });
  /** The catalog is only needed (and only readable) for users who may grant permissions while creating. */
  private readonly catalogResource = rxResource({
    params: () => (this.authorization.can('permissions:read') ? true : undefined),
    stream: () => this.catalogApi.list(),
  });

  readonly filter = signal('');

  readonly roles = computed(() => (this.rolesResource.hasValue() ? this.rolesResource.value() : []));
  readonly filteredRoles = computed(() => {
    const term = this.filter().trim().toLowerCase();
    const roles = [...this.roles()].sort((a, b) => a.name.localeCompare(b.name));
    return term
      ? roles.filter(
          (role) => role.name.toLowerCase().includes(term) || role.description.toLowerCase().includes(term),
        )
      : roles;
  });
  readonly catalog = computed(() => (this.catalogResource.hasValue() ? this.catalogResource.value() : []));
  readonly loading = this.rolesResource.isLoading;
  readonly error = computed(() => {
    const error = this.rolesResource.error();
    return error ? toApiError(error) : null;
  });
  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.roles().length === 0);

  reload(): void {
    this.rolesResource.reload();
  }
}

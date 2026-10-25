import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionCatalogApi } from '../../../core/authorization/permission-catalog.api';
import { permissionResource } from '../../../core/authorization/permissions';
import { toApiError } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/components/page-header';
import { EmptyState, ErrorState, LoadingState } from '../../../shared/components/state-views';

/** Read-only view of the permission catalog, grouped by resource, marking the ones the viewer holds. */
@Component({
  selector: 'app-permissions-page',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    PageHeader,
    EmptyState,
    ErrorState,
    LoadingState,
  ],
  template: `
    <app-page-header
      title="Permissions"
      subtitle="Every permission the system knows. Grant them to users through roles."
    />

    @if (error(); as error) {
      <app-error-state [error]="error" title="Could not load permissions" (retry)="catalog.reload()" />
    } @else if (catalog.isLoading() && !catalog.hasValue()) {
      <app-loading-state label="Loading permissions…" />
    } @else {
      <div class="app-dense mb-4" role="search" aria-label="Filter permissions">
        <mat-form-field class="w-full sm:w-80">
          <mat-label>Filter</mat-label>
          <mat-icon matPrefix aria-hidden="true">filter_list</mat-icon>
          <input matInput [value]="filter()" (input)="filter.set($any($event.target).value)" />
        </mat-form-field>
      </div>
      @if (groups().length === 0) {
        <app-empty-state icon="key_off" title="No permissions match your filter" />
      }
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        @for (group of groups(); track group.resource) {
          <section class="app-card p-4" [attr.aria-labelledby]="'group-' + group.resource">
            <h2 [id]="'group-' + group.resource" class="mb-3 font-medium capitalize">{{ group.resource }}</h2>
            <ul class="flex flex-col gap-2">
              @for (permission of group.permissions; track permission.key) {
                <li class="flex items-start gap-2">
                  @if (held().has(permission.key)) {
                    <mat-icon
                      class="app-icon-sm mt-0.5 text-primary"
                      matTooltip="You have this permission"
                      aria-label="You have this permission"
                      >check_circle</mat-icon
                    >
                  } @else {
                    <mat-icon class="app-icon-sm mt-0.5 text-outline" aria-hidden="true"
                      >radio_button_unchecked</mat-icon
                    >
                  }
                  <div>
                    <div class="font-mono text-xs">{{ permission.key }}</div>
                    <div class="text-sm text-on-surface-variant">{{ permission.description }}</div>
                  </div>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    }
  `,
})
export class PermissionsPage {
  private readonly api = inject(PermissionCatalogApi);
  private readonly auth = inject(AuthService);

  protected readonly catalog = rxResource({ stream: () => this.api.list() });
  protected readonly filter = signal('');
  protected readonly held = this.auth.permissions;

  protected readonly error = computed(() => {
    const error = this.catalog.error();
    return error ? toApiError(error) : null;
  });

  protected readonly groups = computed(() => {
    const term = this.filter().trim().toLowerCase();
    const permissions = (this.catalog.hasValue() ? this.catalog.value() : []).filter(
      (permission) =>
        !term || permission.key.includes(term) || permission.description.toLowerCase().includes(term),
    );
    const byResource = new Map<string, typeof permissions>();
    for (const permission of permissions) {
      const resource = permissionResource(permission.key);
      byResource.set(resource, [...(byResource.get(resource) ?? []), permission]);
    }
    return [...byResource].map(([resource, items]) => ({ resource, permissions: items }));
  });
}

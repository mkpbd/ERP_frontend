import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { Authorization } from '../../../core/authorization/authorization.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeader } from '../../../shared/components/page-header';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { CreateRoleDialog, CreateRoleDialogData } from '../components/create-role-dialog';
import type { Role } from '../models/role.models';
import { RolesStore } from '../state/roles.store';

@Component({
  selector: 'app-roles-list-page',
  providers: [RolesStore],
  imports: [
    RouterLink,
    MatTableModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    PageHeader,
    EmptyState,
    ErrorState,
    StatusBadge,
    HasPermissionDirective,
  ],
  template: `
    <app-page-header title="Roles" subtitle="Named sets of permissions assigned to users.">
      <button matButton="filled" type="button" *appHasPermission="'roles:create'" (click)="openCreate()">
        <mat-icon>add</mat-icon>
        New role
      </button>
    </app-page-header>

    @if (store.error(); as error) {
      <app-error-state [error]="error" title="Could not load roles" (retry)="store.reload()" />
    } @else if (store.isEmpty()) {
      <app-empty-state icon="badge" title="No roles yet" />
    } @else {
      <div class="app-dense mb-4" role="search" aria-label="Filter roles">
        <mat-form-field class="w-full sm:w-80">
          <mat-label>Filter</mat-label>
          <mat-icon matPrefix aria-hidden="true">filter_list</mat-icon>
          <input matInput [value]="store.filter()" (input)="store.filter.set($any($event.target).value)" />
        </mat-form-field>
      </div>
      <div class="app-card overflow-hidden">
        <div class="h-1">
          @if (store.loading()) {
            <mat-progress-bar mode="indeterminate" aria-label="Loading roles" />
          }
        </div>
        <div class="overflow-x-auto">
          <table mat-table [dataSource]="store.filteredRoles()" class="min-w-[560px]" aria-label="Roles">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let role">
                <a [routerLink]="['/roles', role.id]" class="font-medium text-primary hover:underline">{{
                  role.name
                }}</a>
              </td>
            </ng-container>
            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>Description</th>
              <td mat-cell *matCellDef="let role" class="text-on-surface-variant">
                {{ role.description || '—' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="permissions">
              <th mat-header-cell *matHeaderCellDef class="!text-right">Permissions</th>
              <td mat-cell *matCellDef="let role" class="text-right tabular-nums">
                {{ role.permissions.length }}
              </td>
            </ng-container>
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let role">
                <app-status-badge
                  [label]="role.isSystem ? 'System' : 'Custom'"
                  [tone]="role.isSystem ? 'info' : 'neutral'"
                />
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
            <tr class="mat-mdc-row" *matNoDataRow>
              <td
                class="mat-mdc-cell px-4 py-6 text-center text-on-surface-variant"
                [attr.colspan]="columns.length"
              >
                No roles match "{{ store.filter() }}".
              </td>
            </tr>
          </table>
        </div>
      </div>
    }
  `,
})
export class RolesListPage {
  protected readonly store = inject(RolesStore);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly authorization = inject(Authorization);

  protected readonly columns = ['name', 'description', 'permissions', 'type'];

  protected openCreate(): void {
    const data: CreateRoleDialogData = {
      catalog: this.store.catalog(),
      canAssignPermissions: this.authorization.can('permissions:assign'),
    };
    this.dialog
      .open<CreateRoleDialog, CreateRoleDialogData, Role>(CreateRoleDialog, {
        data,
        width: '48rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((role) => {
        if (!role) return;
        this.notifications.success(`Role "${role.name}" created.`);
        void this.router.navigate(['/roles', role.id]);
      });
  }
}

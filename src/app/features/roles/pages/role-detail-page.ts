import { DatePipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header';
import { ErrorState, LoadingState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { applyServerErrors } from '../../../shared/utils/form-errors';
import { PermissionPicker } from '../components/permission-picker';
import { RoleDetailStore } from '../state/role-detail.store';

@Component({
  selector: 'app-role-detail-page',
  providers: [RoleDetailStore],
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    PageHeader,
    ErrorState,
    LoadingState,
    StatusBadge,
    ValidationMessagePipe,
    PermissionPicker,
  ],
  template: `
    @if (store.error(); as error) {
      <app-error-state
        [error]="error"
        [title]="error.status === 404 ? 'Role not found' : 'Could not load the role'"
        [retryable]="error.status !== 404"
        (retry)="store.reload()"
      />
    } @else if (store.role(); as role) {
      <app-page-header [title]="role.name" [subtitle]="'Updated ' + (role.updatedAt | date: 'medium')">
        <app-status-badge
          [label]="role.isSystem ? 'System role' : 'Custom role'"
          [tone]="role.isSystem ? 'info' : 'neutral'"
        />
        @if (store.canDelete()) {
          <button matButton="outlined" type="button" (click)="deleteRole()" [disabled]="!!store.pending()">
            <mat-icon>delete</mat-icon>
            Delete
          </button>
        }
      </app-page-header>

      @if (role.isSystem) {
        <p
          class="mb-4 rounded-card bg-primary-container px-4 py-3 text-sm text-on-primary-container"
          role="note"
        >
          System roles are managed by the application and cannot be changed.
        </p>
      }

      <div class="flex flex-col gap-4">
        <section class="app-card p-5" aria-labelledby="details-heading">
          <h2 id="details-heading" class="mb-4 text-lg font-medium">Details</h2>
          <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-3 lg:max-w-2xl" novalidate>
            <mat-form-field>
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" required />
              <mat-error>{{ form.controls.name.errors | validationMessage: 'Name' }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>Description</mat-label>
              <textarea matInput formControlName="description" rows="2"></textarea>
              <mat-error>{{ form.controls.description.errors | validationMessage: 'Description' }}</mat-error>
            </mat-form-field>
            @if (store.canEdit()) {
              <div>
                <button
                  matButton="filled"
                  type="submit"
                  [disabled]="form.pristine || store.pending() === 'update'"
                >
                  Save details
                </button>
              </div>
            }
          </form>
        </section>

        <section class="app-card p-5" aria-labelledby="permissions-heading">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="permissions-heading" class="text-lg font-medium">
              Permissions ({{ store.selectedPermissions().length }})
            </h2>
            @if (store.canEditPermissions()) {
              <div class="flex gap-2">
                <button
                  matButton
                  type="button"
                  (click)="store.selectedPermissions.set(role.permissions)"
                  [disabled]="!store.permissionsDirty() || !!store.pending()"
                >
                  Discard changes
                </button>
                <button
                  matButton="filled"
                  type="button"
                  (click)="savePermissions()"
                  [disabled]="!store.permissionsDirty() || !!store.pending()"
                >
                  Save permissions
                </button>
              </div>
            }
          </div>
          @if (store.canEditPermissions()) {
            @if (store.permissionsDirty()) {
              <p class="mb-3 text-sm text-on-surface-variant" role="status">
                {{ store.permissionChanges().grant.length }} to grant,
                {{ store.permissionChanges().revoke.length }} to revoke.
              </p>
            }
            <app-permission-picker
              [catalog]="store.catalog()"
              [(selected)]="store.selectedPermissions"
              [disabled]="store.pending() === 'permissions'"
            />
          } @else if (role.permissions.length === 0) {
            <p class="text-sm text-on-surface-variant">This role grants no permissions.</p>
          } @else {
            <ul class="flex flex-wrap gap-1.5" aria-label="Granted permissions">
              @for (permission of role.permissions; track permission) {
                <li class="rounded-pill bg-surface-container-high px-2.5 py-0.5 font-mono text-xs">
                  {{ permission }}
                </li>
              }
            </ul>
          }
        </section>
      </div>
    } @else if (store.loading()) {
      <app-loading-state label="Loading role…" />
    }
  `,
})
export class RoleDetailPage {
  protected readonly store = inject(RoleDetailStore);
  private readonly confirm = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(64)]],
    description: ['', Validators.maxLength(500)],
  });

  constructor() {
    effect(() => {
      const role = this.store.role();
      if (role) this.form.reset({ name: role.name, description: role.description });
      if (this.store.canEdit()) this.form.enable();
      else this.form.disable();
    });
  }

  protected save(): void {
    if (this.form.invalid || this.store.pending()) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, description } = this.form.getRawValue();
    this.store.update({ name: name.trim(), description: description.trim() }).subscribe({
      next: () => this.notifications.success('Role updated.'),
      error: (error: unknown) => {
        const unplaced = applyServerErrors(this.form, toApiError(error), {
          role_name_taken: 'name',
          invalid_role_description: 'description',
        });
        if (unplaced) this.notifications.error(error);
      },
    });
  }

  protected savePermissions(): void {
    const { grant, revoke } = this.store.permissionChanges();
    const save$ =
      revoke.length > 0
        ? this.confirm
            .confirm({
              title: 'Revoke permissions?',
              message: `Every user with this role loses ${revoke.length} permission${revoke.length === 1 ? '' : 's'} (${revoke.join(', ')}) unless another role grants them.`,
              confirmText: 'Save',
              destructive: true,
            })
            .pipe(
              filter(Boolean),
              switchMap(() => this.store.savePermissions()),
            )
        : this.store.savePermissions();
    save$.subscribe({
      next: () =>
        this.notifications.success(`Permissions saved (${grant.length} granted, ${revoke.length} revoked).`),
      error: (error: unknown) => this.notifications.error(error),
    });
  }

  protected deleteRole(): void {
    const role = this.store.role();
    if (!role) return;
    this.confirm
      .confirm({
        title: `Delete the role "${role.name}"?`,
        message: 'This cannot be undone. A role that is still assigned to users cannot be deleted.',
        confirmText: 'Delete role',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.store.delete()),
      )
      .subscribe({
        next: () => {
          this.notifications.success('Role deleted.');
          void this.router.navigate(['/roles']);
        },
        error: (error: unknown) => this.notifications.error(error),
      });
  }
}

import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import type { PermissionDefinition } from '../../../core/authorization/permission-catalog.api';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { applyServerErrors } from '../../../shared/utils/form-errors';
import type { Role } from '../models/role.models';
import { RolesApi } from '../services/roles-api.service';
import { PermissionPicker } from './permission-picker';

export interface CreateRoleDialogData {
  /** Empty when the user may not grant permissions; the role is then created without any. */
  readonly catalog: readonly PermissionDefinition[];
  readonly canAssignPermissions: boolean;
}

@Component({
  selector: 'app-create-role-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ValidationMessagePipe,
    PermissionPicker,
  ],
  template: `
    <h2 mat-dialog-title>New role</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="flex flex-col gap-3">
        @if (error()) {
          <p class="rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
            {{ error() }}
          </p>
        }
        <mat-form-field>
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" required cdkFocusInitial />
          <mat-error>{{ form.controls.name.errors | validationMessage: 'Name' }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="2"></textarea>
          <mat-error>{{ form.controls.description.errors | validationMessage: 'Description' }}</mat-error>
        </mat-form-field>
        @if (data.canAssignPermissions && data.catalog.length) {
          <h3 class="text-sm font-medium">Permissions</h3>
          <p class="-mt-2 text-xs text-on-surface-variant">
            You can only grant permissions you hold yourself.
          </p>
          <app-permission-picker
            [catalog]="data.catalog"
            [(selected)]="permissions"
            [disabled]="submitting()"
          />
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()">Create role</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CreateRoleDialog {
  private readonly api = inject(RolesApi);
  private readonly dialogRef = inject<MatDialogRef<CreateRoleDialog, Role>>(MatDialogRef);
  protected readonly data = inject<CreateRoleDialogData>(MAT_DIALOG_DATA);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(64)]],
    description: ['', Validators.maxLength(500)],
  });
  protected readonly permissions = signal<readonly string[]>([]);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, description } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.api
      .create({ name: name.trim(), description: description.trim(), permissions: this.permissions() })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (role) => this.dialogRef.close(role),
        error: (error: unknown) => {
          const apiError = toApiError(error);
          const unplaced = applyServerErrors(this.form, apiError, {
            role_name_taken: 'name',
            invalid_role_description: 'description',
          });
          if (unplaced) this.error.set(describeError(apiError));
        },
      });
  }
}

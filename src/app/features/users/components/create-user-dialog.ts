import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { applyServerErrors } from '../../../shared/utils/form-errors';
import { notContaining, passwordLength } from '../../../shared/validators/password.validators';
import { UsersApi } from '../services/users-api.service';

@Component({
  selector: 'app-create-user-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ValidationMessagePipe,
  ],
  template: `
    <h2 mat-dialog-title>New user</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="flex flex-col gap-3">
        @if (error()) {
          <p class="rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
            {{ error() }}
          </p>
        }
        <mat-form-field>
          <mat-label>Display name</mat-label>
          <input matInput formControlName="displayName" required cdkFocusInitial />
          <mat-error>{{ form.controls.displayName.errors | validationMessage: 'Display name' }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="off" required />
          <mat-error>{{ form.controls.email.errors | validationMessage: 'Email' }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Username (optional)</mat-label>
          <input matInput formControlName="username" autocomplete="off" />
          <mat-hint>3–32 characters. Can be used to sign in instead of the email.</mat-hint>
          <mat-error>{{ form.controls.username.errors | validationMessage: 'Username' }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Initial password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" required />
          <mat-hint
            >At least 12 characters. Share it securely; the user should change it after signing in.</mat-hint
          >
          <mat-error>{{ form.controls.password.errors | validationMessage: 'Password' }}</mat-error>
        </mat-form-field>
        @if (form.hasError('containsIdentity') && form.controls.password.dirty) {
          <p class="text-sm text-error" role="alert">The password must not contain the email address.</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="create-user-submit">
          Create user
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CreateUserDialog {
  private readonly api = inject(UsersApi);
  private readonly dialogRef = inject<MatDialogRef<CreateUserDialog, { id: string }>>(MatDialogRef);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      displayName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      username: ['', [Validators.minLength(3), Validators.maxLength(32)]],
      password: ['', [Validators.required, passwordLength]],
    },
    { validators: notContaining('email', 'password') },
  );
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { username, ...rest } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.api
      .create({ ...rest, ...(username.trim() ? { username: username.trim() } : {}) })
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: (created) => this.dialogRef.close(created),
        error: (error: unknown) => {
          const apiError = toApiError(error);
          const unplaced = applyServerErrors(this.form, apiError, {
            email_taken: 'email',
            invalid_email: 'email',
            username_taken: 'username',
            weak_password: 'password',
            invalid_display_name: 'displayName',
          });
          if (unplaced) this.error.set(describeError(apiError));
        },
      });
  }
}

import { Component, inject, signal } from '@angular/core';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/services/notification.service';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { applyServerErrors } from '../../../shared/utils/form-errors';
import { fieldsMatch, passwordLength } from '../../../shared/validators/password.validators';
import { AccountApi } from '../services/account-api.service';

@Component({
  selector: 'app-change-password-form',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, ValidationMessagePipe],
  template: `
    <form
      [formGroup]="form"
      (ngSubmit)="submit(formDirective)"
      #formDirective="ngForm"
      class="flex max-w-xl flex-col gap-3"
      novalidate
    >
      <p class="text-sm text-on-surface-variant">Changing your password signs out every other device.</p>
      <mat-form-field>
        <mat-label>Current password</mat-label>
        <input
          matInput
          type="password"
          formControlName="currentPassword"
          autocomplete="current-password"
          required
        />
        <mat-error>{{
          form.controls.currentPassword.errors | validationMessage: 'Current password'
        }}</mat-error>
      </mat-form-field>
      <mat-form-field>
        <mat-label>New password</mat-label>
        <input matInput type="password" formControlName="newPassword" autocomplete="new-password" required />
        <mat-hint>At least 12 characters. Avoid your email address or name.</mat-hint>
        <mat-error>{{ form.controls.newPassword.errors | validationMessage: 'New password' }}</mat-error>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Confirm new password</mat-label>
        <input
          matInput
          type="password"
          formControlName="confirmPassword"
          autocomplete="new-password"
          required
        />
        <mat-error>{{ form.controls.confirmPassword.errors | validationMessage: 'Confirmation' }}</mat-error>
      </mat-form-field>
      <div>
        <button matButton="filled" type="submit" [disabled]="submitting()">Change password</button>
      </div>
    </form>
  `,
})
export class ChangePasswordForm {
  private readonly api = inject(AccountApi);
  private readonly notifications = inject(NotificationService);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordLength]],
      confirmPassword: ['', Validators.required],
    },
    { validators: fieldsMatch('newPassword', 'confirmPassword') },
  );
  protected readonly submitting = signal(false);

  protected submit(formDirective: FormGroupDirective): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting.set(true);
    this.api
      .changePassword(currentPassword, newPassword)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          // resetForm also clears the "submitted" state, so no errors show on the empty form.
          formDirective.resetForm();
          this.notifications.success('Password changed. Other devices have been signed out.');
        },
        error: (error: unknown) => {
          const unplaced = applyServerErrors(this.form, toApiError(error), {
            invalid_current_password: 'currentPassword',
            password_unchanged: 'newPassword',
            weak_password: 'newPassword',
          });
          if (unplaced) this.notifications.error(error);
        },
      });
  }
}

import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApi } from '../../../core/auth/auth-api.service';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { applyServerErrors } from '../../../shared/utils/form-errors';
import { fieldsMatch, passwordLength } from '../../../shared/validators/password.validators';
import { takeFragmentToken } from '../fragment-token';

@Component({
  selector: 'app-reset-password-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ValidationMessagePipe,
  ],
  template: `
    <h1 class="mb-6 text-2xl font-normal">Choose a new password</h1>
    @if (!token) {
      <p class="mb-6 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
        This reset link is incomplete. Open the link from the email again, or request a new one.
      </p>
      <a matButton="filled" routerLink="/forgot-password" class="w-full">Request a new link</a>
    } @else if (done()) {
      <p
        class="mb-6 rounded-card bg-secondary-container px-4 py-3 text-sm text-on-secondary-container"
        role="status"
      >
        Your password has been changed. Sign in with your new password.
      </p>
      <a matButton="filled" routerLink="/login" class="w-full">Sign in</a>
    } @else {
      @if (error()) {
        <p
          class="mb-4 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
          role="alert"
        >
          {{ error() }}
        </p>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4" novalidate>
        <mat-form-field>
          <mat-label>New password</mat-label>
          <input
            matInput
            type="password"
            formControlName="newPassword"
            autocomplete="new-password"
            required
          />
          <mat-hint>At least 12 characters. Avoid your email address or name.</mat-hint>
          <mat-error>{{ form.controls.newPassword.errors | validationMessage: 'Password' }}</mat-error>
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
          <mat-error>{{
            form.controls.confirmPassword.errors | validationMessage: 'Confirmation'
          }}</mat-error>
        </mat-form-field>
        <button matButton="filled" type="submit" class="h-11" [disabled]="submitting()">
          Change password
        </button>
      </form>
    }
  `,
})
export class ResetPasswordPage {
  private readonly authApi = inject(AuthApi);
  protected readonly token = takeFragmentToken();

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      newPassword: ['', [Validators.required, passwordLength]],
      confirmPassword: ['', Validators.required],
    },
    { validators: fieldsMatch('newPassword', 'confirmPassword') },
  );
  protected readonly submitting = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting() || !this.token) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.authApi
      .resetPassword(this.token, this.form.getRawValue().newPassword)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.done.set(true),
        error: (error: unknown) => {
          const apiError = toApiError(error);
          const unplaced = applyServerErrors(this.form, apiError, { weak_password: 'newPassword' });
          if (unplaced) this.error.set(describeError(apiError));
        },
      });
  }
}

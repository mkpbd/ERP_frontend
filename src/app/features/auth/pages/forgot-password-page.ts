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

@Component({
  selector: 'app-forgot-password-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ValidationMessagePipe,
  ],
  template: `
    <h1 class="mb-1 text-2xl font-normal">Forgot your password?</h1>
    @if (sentMessage(); as message) {
      <p
        class="my-6 rounded-card bg-secondary-container px-4 py-3 text-sm text-on-secondary-container"
        role="status"
      >
        {{ message }}
      </p>
      <a matButton="filled" routerLink="/login" class="w-full">Back to sign in</a>
    } @else {
      <p class="mb-6 text-sm text-on-surface-variant">
        Enter the email address of your account and we'll send you a link to choose a new password.
      </p>
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
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" required />
          <mat-error>{{ form.controls.email.errors | validationMessage: 'Email' }}</mat-error>
        </mat-form-field>
        <button matButton="filled" type="submit" class="h-11" [disabled]="submitting()">
          Send reset link
        </button>
        <a matButton routerLink="/login">Back to sign in</a>
      </form>
    }
  `,
})
export class ForgotPasswordPage {
  private readonly authApi = inject(AuthApi);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });
  protected readonly submitting = signal(false);
  protected readonly sentMessage = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.authApi
      .forgotPassword(this.form.getRawValue().email)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        // The backend answers the same way whether or not the account exists.
        next: (response) => this.sentMessage.set(response.message),
        error: (error: unknown) => this.error.set(describeError(toApiError(error))),
      });
  }
}

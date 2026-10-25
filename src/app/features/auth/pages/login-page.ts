import { Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApi } from '../../../core/auth/auth-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError, toApiError } from '../../../core/http/api-error';
import { describeError, NotificationService } from '../../../core/services/notification.service';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';

/** Only same-app paths are accepted as `returnUrl`, so the login page cannot be used as an open redirect. */
export function safeReturnUrl(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return '/dashboard';
  return value.startsWith('/login') ? '/dashboard' : value;
}

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ValidationMessagePipe,
  ],
  template: `
    <h1 class="mb-1 text-2xl font-normal">Sign in</h1>
    <p class="mb-6 text-sm text-on-surface-variant">Use your email address or username.</p>

    @if (notice(); as notice) {
      <p
        class="mb-4 rounded-card bg-secondary-container px-4 py-3 text-sm text-on-secondary-container"
        role="status"
      >
        {{ notice }}
      </p>
    }
    @if (error(); as error) {
      <div
        class="mb-4 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
        role="alert"
        data-testid="login-error"
      >
        {{ errorText() }}
        @if (error.code === 'email_not_verified') {
          <button
            matButton
            type="button"
            class="mt-1"
            (click)="resendVerification()"
            [disabled]="resending()"
          >
            Resend verification email
          </button>
        }
      </div>
    }

    <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4" novalidate>
      <mat-form-field>
        <mat-label>Email or username</mat-label>
        <input matInput formControlName="identifier" autocomplete="username" required />
        <mat-error>{{ form.controls.identifier.errors | validationMessage: 'Email or username' }}</mat-error>
      </mat-form-field>

      <mat-form-field>
        <mat-label>Password</mat-label>
        <input
          matInput
          [type]="showPassword() ? 'text' : 'password'"
          formControlName="password"
          autocomplete="current-password"
          required
        />
        <button
          matIconSuffix
          matIconButton
          type="button"
          (click)="showPassword.set(!showPassword())"
          [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
          [attr.aria-pressed]="showPassword()"
        >
          <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-error>{{ form.controls.password.errors | validationMessage: 'Password' }}</mat-error>
      </mat-form-field>

      <div class="-mt-2 text-right text-sm">
        <a routerLink="/forgot-password" class="text-primary hover:underline">Forgot password?</a>
      </div>

      <button
        matButton="filled"
        type="submit"
        class="h-11"
        [disabled]="submitting()"
        data-testid="login-submit"
      >
        @if (submitting()) {
          <mat-spinner diameter="20" aria-label="Signing in" />
        } @else {
          Sign in
        }
      </button>
    </form>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  /** Query parameters, bound by withComponentInputBinding. */
  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    identifier: ['', [Validators.required, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected readonly submitting = signal(false);
  protected readonly resending = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly errorText = computed(() => {
    const error = this.error();
    if (!error) return '';
    // The backend answers unknown accounts, wrong passwords and lockouts identically on purpose.
    return error.code === 'invalid_credentials'
      ? 'Incorrect email/username or password.'
      : describeError(error);
  });
  protected readonly notice = computed(() =>
    this.reason() === 'expired' ? 'Your session has expired. Please sign in again.' : null,
  );

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
        error: (error: unknown) => {
          this.error.set(toApiError(error));
          this.form.controls.password.reset();
        },
      });
  }

  protected resendVerification(): void {
    const identifier = this.form.controls.identifier.value;
    if (!identifier.includes('@')) {
      this.notifications.info('Enter your email address above to resend the verification email.');
      return;
    }
    this.resending.set(true);
    this.authApi
      .resendVerification(identifier)
      .pipe(finalize(() => this.resending.set(false)))
      .subscribe({
        next: (response) => this.notifications.success(response.message),
        error: (error: unknown) => this.notifications.error(error),
      });
  }
}

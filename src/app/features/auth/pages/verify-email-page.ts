import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AuthApi } from '../../../core/auth/auth-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import { LoadingState } from '../../../shared/components/state-views';
import { takeFragmentToken } from '../fragment-token';

type VerifyState = { kind: 'verifying' } | { kind: 'done' } | { kind: 'failed'; message: string };

@Component({
  selector: 'app-verify-email-page',
  imports: [MatButtonModule, RouterLink, LoadingState],
  template: `
    <h1 class="mb-6 text-2xl font-normal">Verify your email</h1>
    @switch (state().kind) {
      @case ('verifying') {
        <app-loading-state label="Verifying your email address…" />
      }
      @case ('done') {
        <p
          class="mb-6 rounded-card bg-secondary-container px-4 py-3 text-sm text-on-secondary-container"
          role="status"
        >
          Your email address is verified.
        </p>
        <a matButton="filled" [routerLink]="auth.isAuthenticated() ? '/dashboard' : '/login'" class="w-full"
          >Continue</a
        >
      }
      @case ('failed') {
        <p
          class="mb-6 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
          role="alert"
        >
          {{ failure() }}
        </p>
        <a matButton="filled" routerLink="/login" class="w-full">Back to sign in</a>
      }
    }
  `,
})
export class VerifyEmailPage implements OnInit {
  private readonly authApi = inject(AuthApi);
  protected readonly auth = inject(AuthService);
  private readonly token = takeFragmentToken();

  protected readonly state = signal<VerifyState>({ kind: 'verifying' });
  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'failed' ? state.message : '';
  });

  ngOnInit(): void {
    if (!this.token) {
      this.state.set({
        kind: 'failed',
        message: 'This verification link is incomplete. Open the link from the email again.',
      });
      return;
    }
    this.authApi.verifyEmail(this.token).subscribe({
      next: () => this.state.set({ kind: 'done' }),
      error: (error: unknown) =>
        this.state.set({ kind: 'failed', message: describeError(toApiError(error)) }),
    });
  }
}

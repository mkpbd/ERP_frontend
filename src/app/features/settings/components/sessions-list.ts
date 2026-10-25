import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { filter, finalize, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog';
import { ErrorState, LoadingState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { AccountApi, AccountSession } from '../services/account-api.service';

/** Short, readable label for a user-agent string ("Chrome on Windows"). */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'unknown OS';
  return `${browser} on ${os}`;
}

@Component({
  selector: 'app-sessions-list',
  imports: [DatePipe, MatListModule, MatButtonModule, MatIconModule, ErrorState, LoadingState, StatusBadge],
  template: `
    <div class="flex max-w-3xl flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-on-surface-variant">Devices where you are signed in.</p>
        <button matButton="outlined" type="button" (click)="signOutEverywhere()" [disabled]="!!busy()">
          <mat-icon>logout</mat-icon>
          Sign out everywhere
        </button>
      </div>

      @if (error(); as error) {
        <app-error-state [error]="error" title="Could not load your sessions" (retry)="sessions.reload()" />
      } @else if (sessions.isLoading() && !sessions.hasValue()) {
        <app-loading-state label="Loading sessions…" />
      } @else {
        <mat-list class="app-card" aria-label="Active sessions">
          @for (session of sorted(); track session.id) {
            <mat-list-item lines="3">
              <mat-icon matListItemIcon aria-hidden="true">{{
                session.current ? 'computer' : 'devices'
              }}</mat-icon>
              <span matListItemTitle class="flex items-center gap-2">
                {{ describe(session.userAgent) }}
                @if (session.current) {
                  <app-status-badge label="This device" tone="info" />
                }
              </span>
              <span matListItemLine
                >{{ session.ipAddress ?? 'Unknown IP' }} · last active
                {{ session.lastUsedAt | date: 'medium' }}</span
              >
              <span matListItemLine>Signed in {{ session.createdAt | date: 'medium' }}</span>
              @if (!session.current) {
                <button
                  matListItemMeta
                  matIconButton
                  type="button"
                  [attr.aria-label]="'Sign out ' + describe(session.userAgent)"
                  (click)="revoke(session)"
                  [disabled]="!!busy()"
                >
                  <mat-icon>close</mat-icon>
                </button>
              }
            </mat-list-item>
          }
        </mat-list>
      }
    </div>
  `,
})
export class SessionsList {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  protected readonly sessions = rxResource({ stream: () => this.api.sessions() });
  protected readonly busy = signal<string | null>(null);
  protected readonly describe = describeUserAgent;

  protected readonly sorted = computed(() =>
    (this.sessions.hasValue() ? [...this.sessions.value()] : []).sort(
      (a, b) => Number(b.current) - Number(a.current) || b.lastUsedAt.localeCompare(a.lastUsedAt),
    ),
  );
  protected readonly error = computed(() => {
    const error = this.sessions.error();
    return error ? toApiError(error) : null;
  });

  protected revoke(session: AccountSession): void {
    this.busy.set(session.id);
    this.api
      .revokeSession(session.id)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: () => {
          this.notifications.success('Session signed out.');
          this.sessions.reload();
        },
        error: (error: unknown) => this.notifications.error(error),
      });
  }

  protected signOutEverywhere(): void {
    this.confirm
      .confirm({
        title: 'Sign out everywhere?',
        message: 'Every session ends, including this one. You will need to sign in again.',
        confirmText: 'Sign out everywhere',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.busy.set('all');
          return this.api.logoutAll().pipe(finalize(() => this.busy.set(null)));
        }),
      )
      .subscribe({
        next: () => this.auth.endSession(),
        error: (error: unknown) => this.notifications.error(error),
      });
  }
}

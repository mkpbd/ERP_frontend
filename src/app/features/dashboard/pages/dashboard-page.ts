import { DatePipe } from '@angular/common';
import { Component, computed, inject, Resource } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Authorization } from '../../../core/authorization/authorization.service';
import { EmptyState, ErrorState, LoadingState } from '../../../shared/components/state-views';
import { BadgeTone, StatusBadge } from '../../../shared/components/status-badge';
import { DashboardSections } from '../components/dashboard-sections';
import { StatCard } from '../components/stat-card';
import { DashboardApi, RecentActivity } from '../services/dashboard-api.service';
import { toApiError } from '../../../core/http/api-error';

/** `null` while loading, `undefined` on error, otherwise the value (the StatCard contract). */
function statValue(resource: Resource<number | undefined>): number | null | undefined {
  if (resource.error()) return undefined;
  return resource.hasValue() ? resource.value() : null;
}

const OUTCOME_TONES: Record<RecentActivity['outcome'], BadgeTone> = {
  success: 'success',
  failure: 'warning',
  denied: 'danger',
};

@Component({
  selector: 'app-dashboard-page',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    DashboardSections,
    StatCard,
    StatusBadge,
    EmptyState,
    ErrorState,
    LoadingState,
  ],
  template: `
    <section class="mb-6" aria-labelledby="welcome-heading">
      <h1 id="welcome-heading" class="text-2xl font-normal">{{ greeting() }}, {{ firstName() }}</h1>
      <p class="mt-1 text-sm text-on-surface-variant">
        @if (user()?.roles?.length) {
          Signed in as {{ user()?.roles?.join(', ') }}.
        } @else {
          Your account has no roles yet, so you can only manage your own profile.
        }
      </p>
    </section>

    <app-dashboard-sections />

    @if (showStats()) {
      <section class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Summary">
        @if (authorization.can('users:read')) {
          <app-stat-card label="Active users" icon="group" link="/users" [value]="activeUsers()" />
        }
        @if (authorization.can('roles:read')) {
          <app-stat-card label="Roles" icon="badge" link="/roles" [value]="roles()" />
        }
      </section>
    }

    @if (authorization.can('audit:read')) {
      <!-- Below the fold on small screens: render the list only once it scrolls into view. -->
      @defer (on viewport) {
        <section class="app-card p-5" aria-labelledby="activity-heading">
          <div class="mb-3 flex items-center justify-between">
            <h2 id="activity-heading" class="text-lg font-medium">Recent activity</h2>
            <a matButton routerLink="/audit">View all</a>
          </div>
          @if (activityError(); as error) {
            <app-error-state
              [error]="error"
              title="Could not load recent activity"
              (retry)="activity.reload()"
            />
          } @else if (activity.isLoading() && !activity.hasValue()) {
            <app-loading-state label="Loading recent activity…" />
          } @else if (activityItems().length === 0) {
            <app-empty-state icon="history" title="No activity yet" />
          } @else {
            <ul class="divide-y divide-outline-variant">
              @for (item of activityItems(); track item.id) {
                <li class="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div class="min-w-0">
                    <div class="truncate font-mono text-sm">{{ item.action }}</div>
                    <div class="text-xs text-on-surface-variant">
                      {{ item.resourceType }} · {{ item.occurredAt | date: 'medium' }}
                    </div>
                  </div>
                  <app-status-badge [label]="item.outcome" [tone]="tones[item.outcome]" />
                </li>
              }
            </ul>
          }
        </section>
      } @placeholder {
        <div class="app-card h-64" aria-hidden="true"></div>
      }
    }

    @if (!showStats() && !authorization.can('audit:read')) {
      <section class="app-card p-5">
        <h2 class="mb-2 text-lg font-medium">Get started</h2>
        <p class="mb-4 text-sm text-on-surface-variant">
          Review your profile and the devices you are signed in on.
        </p>
        <a matButton="filled" routerLink="/settings"><mat-icon>manage_accounts</mat-icon> Account settings</a>
      </section>
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly auth = inject(AuthService);
  protected readonly authorization = inject(Authorization);
  protected readonly tones = OUTCOME_TONES;

  protected readonly user = this.auth.user;
  protected readonly firstName = computed(() => this.user()?.displayName.split(/\s+/)[0] ?? '');
  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  });
  protected readonly showStats = computed(() => this.authorization.canAny(['users:read', 'roles:read']));

  private readonly activeUsersResource = rxResource({
    params: () => (this.authorization.can('users:read') ? true : undefined),
    stream: () => this.api.countUsers('active'),
  });
  private readonly rolesResource = rxResource({
    params: () => (this.authorization.can('roles:read') ? true : undefined),
    stream: () => this.api.countRoles(),
  });
  protected readonly activity = rxResource({
    params: () => (this.authorization.can('audit:read') ? true : undefined),
    stream: () => this.api.recentActivity(),
  });

  protected readonly activeUsers = computed(() => statValue(this.activeUsersResource));
  protected readonly roles = computed(() => statValue(this.rolesResource));
  protected readonly activityItems = computed(() => (this.activity.hasValue() ? this.activity.value() : []));
  protected readonly activityError = computed(() => {
    const error = this.activity.error();
    return error ? toApiError(error) : null;
  });
}

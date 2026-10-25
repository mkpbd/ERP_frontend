import { DatePipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, switchMap } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header';
import { ErrorState, LoadingState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { applyServerErrors } from '../../../shared/utils/form-errors';
import { UserDetailStore } from '../state/user-detail.store';

@Component({
  selector: 'app-user-detail-page',
  providers: [UserDetailStore],
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    PageHeader,
    ErrorState,
    LoadingState,
    StatusBadge,
    HasPermissionDirective,
    ValidationMessagePipe,
  ],
  template: `
    @if (store.error(); as error) {
      <app-error-state
        [error]="error"
        [title]="error.status === 404 ? 'User not found' : 'Could not load the user'"
        [retryable]="error.status !== 404"
        (retry)="store.reload()"
      />
    } @else if (store.user(); as user) {
      <app-page-header [title]="user.displayName" [subtitle]="user.email">
        <app-status-badge
          [label]="user.status === 'active' ? 'Active' : 'Deactivated'"
          [tone]="user.status === 'active' ? 'success' : 'neutral'"
        />
        <ng-container *appHasPermission="'sessions:revoke'">
          @if (!store.isSelf()) {
            <button
              matButton="outlined"
              type="button"
              (click)="revokeSessions()"
              [disabled]="!!store.pending()"
            >
              <mat-icon>devices_off</mat-icon>
              Sign out everywhere
            </button>
          }
        </ng-container>
        <ng-container *appHasPermission="'users:deactivate'">
          @if (!store.isSelf()) {
            @if (user.status === 'active') {
              <button
                matButton="outlined"
                type="button"
                (click)="setActive(false)"
                [disabled]="!!store.pending()"
              >
                <mat-icon>block</mat-icon>
                Deactivate
              </button>
            } @else {
              <button
                matButton="filled"
                type="button"
                (click)="setActive(true)"
                [disabled]="!!store.pending()"
              >
                <mat-icon>check_circle</mat-icon>
                Activate
              </button>
            }
          }
        </ng-container>
      </app-page-header>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="app-card p-5" aria-labelledby="profile-heading">
          <h2 id="profile-heading" class="mb-4 text-lg font-medium">Profile</h2>
          @if (store.canRename()) {
            <form
              [formGroup]="profileForm"
              (ngSubmit)="rename()"
              class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start"
              novalidate
            >
              <mat-form-field class="flex-1">
                <mat-label>Display name</mat-label>
                <input matInput formControlName="displayName" required />
                <mat-error>{{
                  profileForm.controls.displayName.errors | validationMessage: 'Display name'
                }}</mat-error>
              </mat-form-field>
              <button
                matButton="filled"
                type="submit"
                class="sm:mt-2"
                [disabled]="profileForm.pristine || store.pending() === 'rename'"
              >
                Save
              </button>
            </form>
          }
          <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt class="text-on-surface-variant">Email</dt>
            <dd class="flex items-center gap-1">
              {{ user.email }}
              @if (user.emailVerified) {
                <mat-icon class="app-icon-sm text-primary" matTooltip="Verified" aria-label="Verified"
                  >verified</mat-icon
                >
              } @else {
                <span class="text-on-surface-variant">(not verified)</span>
              }
            </dd>
            <dt class="text-on-surface-variant">Username</dt>
            <dd>{{ user.username ?? '—' }}</dd>
            <dt class="text-on-surface-variant">Last sign-in</dt>
            <dd>{{ user.lastLoginAt ? (user.lastLoginAt | date: 'medium') : 'Never' }}</dd>
            <dt class="text-on-surface-variant">Created</dt>
            <dd>{{ user.createdAt | date: 'medium' }}</dd>
            <dt class="text-on-surface-variant">Updated</dt>
            <dd>{{ user.updatedAt | date: 'medium' }}</dd>
          </dl>
        </section>

        @if (store.canSeeAccess()) {
          <section class="app-card p-5" aria-labelledby="roles-heading">
            <h2 id="roles-heading" class="mb-4 text-lg font-medium">Roles</h2>
            @if (store.roles().length === 0 && !store.rolesLoading()) {
              <p class="mb-4 text-sm text-on-surface-variant">
                No roles assigned. This user can only manage their own account.
              </p>
            } @else {
              <mat-chip-set aria-label="Assigned roles" class="mb-4 block">
                @for (role of store.roles(); track role.roleId) {
                  <mat-chip
                    [removable]="store.canAssignRoles()"
                    (removed)="removeRole(role.roleId, role.name)"
                  >
                    {{ role.name }}
                    @if (store.canAssignRoles()) {
                      <button
                        matChipRemove
                        [attr.aria-label]="'Remove role ' + role.name"
                        [disabled]="!!store.pending()"
                      >
                        <mat-icon>cancel</mat-icon>
                      </button>
                    }
                  </mat-chip>
                }
              </mat-chip-set>
            }
            @if (store.canAssignRoles() && store.assignableRoles().length > 0) {
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
                <mat-form-field class="flex-1">
                  <mat-label>Add role</mat-label>
                  <mat-select [formControl]="roleToAssign">
                    @for (role of store.assignableRoles(); track role.id) {
                      <mat-option [value]="role.id">{{ role.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button
                  matButton="tonal"
                  type="button"
                  class="sm:mt-2"
                  (click)="assignRole()"
                  [disabled]="!roleToAssign.value || !!store.pending()"
                >
                  Assign
                </button>
              </div>
            }

            <h3 class="mb-2 mt-4 text-sm font-medium text-on-surface-variant">Effective permissions</h3>
            @if (store.permissions().length === 0) {
              <p class="text-sm text-on-surface-variant">None.</p>
            } @else {
              <ul class="flex flex-wrap gap-1.5" aria-label="Effective permissions">
                @for (permission of store.permissions(); track permission) {
                  <li class="rounded-pill bg-surface-container-high px-2.5 py-0.5 font-mono text-xs">
                    {{ permission }}
                  </li>
                }
              </ul>
            }
          </section>
        }
      </div>
    } @else if (store.loading()) {
      <app-loading-state label="Loading user…" />
    }
  `,
})
export class UserDetailPage {
  protected readonly store = inject(UserDetailStore);
  private readonly confirm = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  protected readonly profileForm = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
  });
  protected readonly roleToAssign = new FormControl<string | null>(null);

  constructor() {
    // Sync the form with the loaded user (a DOM-free side effect that cannot be expressed as computed()).
    effect(() => {
      const user = this.store.user();
      if (user) this.profileForm.reset({ displayName: user.displayName });
    });
  }

  protected rename(): void {
    if (this.profileForm.invalid || this.store.pending()) return;
    this.store.rename(this.profileForm.getRawValue().displayName.trim()).subscribe({
      next: () => this.notifications.success('Display name updated.'),
      error: (error: unknown) => {
        const unplaced = applyServerErrors(this.profileForm, toApiError(error), {
          invalid_display_name: 'displayName',
        });
        if (unplaced) this.notifications.error(error);
      },
    });
  }

  protected setActive(active: boolean): void {
    const user = this.store.user();
    if (!user) return;
    const request$ = active
      ? this.store.setActive(true)
      : this.confirm
          .confirm({
            title: `Deactivate ${user.displayName}?`,
            message:
              'They are signed out immediately and cannot sign in until the account is activated again.',
            confirmText: 'Deactivate',
            destructive: true,
          })
          .pipe(
            filter(Boolean),
            switchMap(() => this.store.setActive(false)),
          );
    request$.subscribe({
      next: () => this.notifications.success(active ? 'User activated.' : 'User deactivated.'),
      error: (error: unknown) => this.notifications.error(error),
    });
  }

  protected revokeSessions(): void {
    this.confirm
      .confirm({
        title: 'Sign this user out everywhere?',
        message: 'Every active session of this user ends now. They can sign in again with their password.',
        confirmText: 'Sign out everywhere',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.store.revokeSessions()),
      )
      .subscribe({
        next: (count) => this.notifications.success(`${count} session${count === 1 ? '' : 's'} ended.`),
        error: (error: unknown) => this.notifications.error(error),
      });
  }

  protected assignRole(): void {
    const roleId = this.roleToAssign.value;
    if (!roleId) return;
    this.store.assignRole(roleId).subscribe({
      next: () => {
        this.roleToAssign.reset();
        this.notifications.success('Role assigned.');
      },
      error: (error: unknown) => this.notifications.error(error),
    });
  }

  protected removeRole(roleId: string, name: string): void {
    this.confirm
      .confirm({
        title: `Remove the role "${name}"?`,
        message: 'The user loses the permissions this role grants (unless another role grants them too).',
        confirmText: 'Remove role',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.store.removeRole(roleId)),
      )
      .subscribe({
        next: () => this.notifications.success('Role removed.'),
        error: (error: unknown) => this.notifications.error(error),
      });
  }
}

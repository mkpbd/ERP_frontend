import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, map, Observable, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Authorization } from '../../../core/authorization/authorization.service';
import { toApiError } from '../../../core/http/api-error';
import { UsersApi } from '../services/users-api.service';

export type UserAction =
  'rename' | 'activate' | 'deactivate' | 'revoke-sessions' | 'assign-role' | 'remove-role';

/**
 * State for one user's detail page. Provided by the page, so it reads that page's `:id` and is discarded
 * with it. Related data (roles, effective permissions, role options) only loads when the current user is
 * allowed to see it, which avoids a burst of 403s for users with partial access.
 */
@Injectable()
export class UserDetailStore {
  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly authorization = inject(Authorization);

  readonly userId = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')), {
    requireSync: true,
  });

  readonly isSelf = computed(() => this.auth.user()?.id === this.userId());
  readonly canSeeAccess = computed(() => this.isSelf() || this.authorization.can('permissions:read'));
  readonly canAssignRoles = computed(
    () => this.authorization.can('permissions:assign') && this.authorization.can('roles:read'),
  );
  readonly canRename = computed(() => this.isSelf() || this.authorization.can('users:update'));

  private readonly userResource = rxResource({
    params: () => this.userId() || undefined,
    stream: ({ params }) => this.api.get(params),
  });
  private readonly rolesResource = rxResource({
    params: () => (this.canSeeAccess() ? this.userId() : undefined),
    stream: ({ params }) => this.api.roles(params),
  });
  private readonly permissionsResource = rxResource({
    params: () => (this.canSeeAccess() ? this.userId() : undefined),
    stream: ({ params }) => this.api.effectivePermissions(params),
  });
  private readonly roleOptionsResource = rxResource({
    params: () => (this.canAssignRoles() ? true : undefined),
    stream: () => this.api.roleOptions(),
  });

  readonly user = computed(() => (this.userResource.hasValue() ? this.userResource.value() : null));
  readonly loading = this.userResource.isLoading;
  readonly error = computed(() => {
    const error = this.userResource.error();
    return error ? toApiError(error) : null;
  });

  readonly roles = computed(() => (this.rolesResource.hasValue() ? this.rolesResource.value() : []));
  readonly rolesLoading = this.rolesResource.isLoading;
  readonly permissions = computed(() =>
    this.permissionsResource.hasValue() ? [...this.permissionsResource.value().permissions].sort() : [],
  );

  /** Roles the user does not hold yet. */
  readonly assignableRoles = computed(() => {
    const held = new Set(this.roles().map((role) => role.roleId));
    const options = this.roleOptionsResource.hasValue() ? this.roleOptionsResource.value() : [];
    return options.filter((role) => !held.has(role.id));
  });

  /** The action currently running, so the page can disable buttons and prevent double submits. */
  readonly pending = signal<UserAction | null>(null);

  reload(): void {
    this.userResource.reload();
    this.rolesResource.reload();
    this.permissionsResource.reload();
  }

  rename(displayName: string): Observable<void> {
    return this.run('rename', this.api.update(this.userId(), { displayName }), () =>
      this.userResource.reload(),
    );
  }

  setActive(active: boolean): Observable<void> {
    const id = this.userId();
    return this.run(
      active ? 'activate' : 'deactivate',
      active ? this.api.activate(id) : this.api.deactivate(id),
      () => this.userResource.reload(),
    );
  }

  revokeSessions(): Observable<number> {
    this.pending.set('revoke-sessions');
    return this.api.revokeSessions(this.userId()).pipe(
      map((result) => result.revoked),
      finalize(() => this.pending.set(null)),
    );
  }

  assignRole(roleId: string): Observable<void> {
    return this.run('assign-role', this.api.assignRole(this.userId(), roleId), () => this.reloadAccess());
  }

  removeRole(roleId: string): Observable<void> {
    return this.run('remove-role', this.api.removeRole(this.userId(), roleId), () => this.reloadAccess());
  }

  private reloadAccess(): void {
    this.rolesResource.reload();
    this.permissionsResource.reload();
  }

  private run(action: UserAction, request: Observable<void>, onSuccess: () => void): Observable<void> {
    this.pending.set(action);
    return request.pipe(
      tap(onSuccess),
      // Changes to yourself (name, roles) also change what the shell shows and what you may do.
      switchMap(() => (this.isSelf() ? this.auth.reloadUser().pipe(map(() => undefined)) : of(undefined))),
      finalize(() => this.pending.set(null)),
    );
  }
}

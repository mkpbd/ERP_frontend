import type { UserStatus } from '../../../core/auth/auth.models';
import type { SortOrder } from '../../../shared/models/page';

export type { UserStatus };

/** `GET /users` item and `GET /users/:id`. */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly username: string | null;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly emailVerified: boolean;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type UserSortField = 'createdAt' | 'email' | 'displayName';

export interface UserListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: UserStatus;
  readonly sort: UserSortField;
  readonly order: SortOrder;
}

export interface CreateUserRequest {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly username?: string;
}

export interface UpdateUserRequest {
  readonly displayName: string;
}

/** `GET /users/:id/roles`. */
export interface UserRole {
  readonly roleId: string;
  readonly name: string;
  readonly assignedAt: string;
}

/** `GET /users/:id/permissions`. */
export interface EffectivePermissions {
  readonly userId: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

/** `GET /roles` item, as far as the users feature needs it (role picker). */
export interface RoleOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isSystem: boolean;
}

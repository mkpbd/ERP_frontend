import type { Permission } from '../authorization/permissions';

export type UserStatus = 'active' | 'deactivated';

/** `GET /users/me`. */
export interface CurrentUser {
  readonly id: string;
  readonly email: string;
  readonly username: string | null;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly emailVerified: boolean;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly roles: readonly string[];
  /** Effective permissions. Unknown future keys are kept as plain strings. */
  readonly permissions: readonly (Permission | (string & {}))[];
}

/** `POST /auth/login` body. `identifier` is an email address or a username. */
export interface LoginRequest {
  readonly identifier: string;
  readonly password: string;
}

/** `POST /auth/login` and `/auth/refresh` response. The refresh token travels in an HttpOnly cookie. */
export interface TokenResponse {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly accessTokenExpiresAt: string;
  readonly refreshTokenExpiresAt: string;
}

export interface MessageResponse {
  readonly message: string;
}

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

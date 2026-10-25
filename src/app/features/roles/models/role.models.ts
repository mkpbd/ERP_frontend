/** `GET /roles` item and `GET /roles/:id`. */
export interface Role {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** System roles (e.g. super-admin) are immutable through the API. */
  readonly isSystem: boolean;
  readonly permissions: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateRoleRequest {
  readonly name: string;
  readonly description?: string;
  readonly permissions?: readonly string[];
}

export interface UpdateRoleRequest {
  readonly name?: string;
  readonly description?: string;
}

/** Which permissions to grant and revoke to turn `current` into `desired`. */
export function diffPermissions(
  current: readonly string[],
  desired: readonly string[],
): { grant: string[]; revoke: string[] } {
  const currentSet = new Set(current);
  const desiredSet = new Set(desired);
  return {
    grant: desired.filter((key) => !currentSet.has(key)),
    revoke: current.filter((key) => !desiredSet.has(key)),
  };
}

import type { Permission } from '../../core/authorization/permissions';

/** A backend record (`createRecordController`): its id and whatever fields its master has. */
export type RecordRow = { readonly id: string } & Readonly<Record<string, unknown>>;

export interface MasterField {
  readonly key: string;
  readonly label: string;
  readonly kind: 'text' | 'textarea' | 'toggle';
  readonly required?: boolean;
  readonly max?: number;
  /** Shown in the table. */
  readonly listed?: boolean;
  /** Rows of a textarea (default 5). */
  readonly rows?: number;
}

/** A simple master kept through the backend's record endpoints (`GET`, `POST`, `PATCH`, `DELETE` on `path`). */
export interface MasterDefinition {
  /** The endpoint under the API base, e.g. `hospital/ot-rooms`. */
  readonly path: string;
  readonly label: string;
  /** Singular, for buttons and titles. */
  readonly noun: string;
  /** Needed to add, edit and delete. */
  readonly managePermission: Permission;
  readonly fields: readonly MasterField[];
}

/** The form's value as the backend takes it: text trimmed, empty optional text as null. */
export function toMasterBody(
  definition: MasterDefinition,
  value: Readonly<Record<string, string | boolean>>,
): Record<string, string | boolean | null> {
  const body: Record<string, string | boolean | null> = {};
  for (const field of definition.fields) {
    const raw = value[field.key];
    if (field.kind === 'toggle') body[field.key] = raw === true;
    else {
      const text = typeof raw === 'string' ? raw.trim() : '';
      body[field.key] = text || (field.required ? '' : null);
    }
  }
  return body;
}

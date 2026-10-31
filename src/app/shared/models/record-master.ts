import type { Permission } from '../../core/authorization/permissions';

/** A backend record (`createRecordController`): its id and whatever fields its master has. */
export type RecordRow = { readonly id: string } & Readonly<Record<string, unknown>>;

/** A choice of a `select` or `multi` field: the value sent and the text shown. */
export interface MasterOption {
  readonly value: string;
  readonly label: string;
}

export interface MasterField {
  readonly key: string;
  readonly label: string;
  /**
   * `number`: a number (whole unless `decimals`); `select`: one of `options` or of `lookup`'s records (none
   * allowed unless required); `multi`: any of `options`, sent as a list.
   */
  readonly kind: 'text' | 'textarea' | 'toggle' | 'number' | 'select' | 'multi';
  readonly required?: boolean;
  /** Text: the most characters. */
  readonly max?: number;
  /** Number: the smallest and largest value. */
  readonly min?: number;
  readonly maxValue?: number;
  /** Number: the decimals allowed (default 0). */
  readonly decimals?: number;
  readonly options?: readonly MasterOption[];
  /** Select: the choices are another master's records (its endpoint, and the field to show). */
  readonly lookup?: { readonly path: string; readonly label: string };
  /** Select: what no choice means (e.g. "Any department"); multi: what none means (e.g. "Every day"). */
  readonly emptyLabel?: string;
  /** The value of a new record (toggles start on). */
  readonly initial?: string | number | readonly string[];
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

export type MasterValue = string | number | boolean | readonly string[] | null;

/**
 * The form's value as the backend takes it: text trimmed, empty optional text, numbers and choices as null,
 * numbers as numbers, lists as lists.
 */
export function toMasterBody(
  definition: MasterDefinition,
  value: Readonly<Record<string, MasterValue>>,
): Record<string, MasterValue> {
  const body: Record<string, MasterValue> = {};
  for (const field of definition.fields) {
    const raw = value[field.key];
    switch (field.kind) {
      case 'toggle':
        body[field.key] = raw === true;
        break;
      case 'number':
        body[field.key] = raw === null || raw === undefined || raw === '' ? null : Number(raw);
        break;
      case 'select':
        body[field.key] = typeof raw === 'string' && raw ? raw : null;
        break;
      case 'multi':
        body[field.key] = Array.isArray(raw) ? [...(raw as readonly string[])] : [];
        break;
      default: {
        const text = typeof raw === 'string' ? raw.trim() : '';
        body[field.key] = text || (field.required ? '' : null);
      }
    }
  }
  return body;
}

/** How a field's value reads in a table: a choice by its label, a list joined, nothing as a dash. */
export function displayValue(
  field: MasterField,
  value: unknown,
  options: readonly MasterOption[] = [],
): string {
  const choices = field.options ?? options;
  const label = (choice: unknown) =>
    choices.find((option) => option.value === choice)?.label ?? String(choice);
  if (field.kind === 'multi') {
    const list = Array.isArray(value) ? (value as unknown[]) : [];
    return list.length ? list.map(label).join(', ') : (field.emptyLabel ?? '—');
  }
  if (value === null || value === undefined || value === '') {
    return field.kind === 'select' ? (field.emptyLabel ?? '—') : '—';
  }
  if (field.kind === 'select') return label(value);
  if (field.kind === 'number' && field.decimals) return Number(value).toFixed(field.decimals);
  return String(value);
}

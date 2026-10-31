import type { OtMaster } from '../services/ot-api.service';

export interface MasterField {
  readonly key: string;
  readonly label: string;
  readonly kind: 'text' | 'textarea' | 'toggle';
  readonly required?: boolean;
  readonly max?: number;
  /** Shown in the table. */
  readonly listed?: boolean;
}

export interface MasterDefinition {
  readonly master: OtMaster;
  readonly label: string;
  /** Singular, for buttons and titles. */
  readonly noun: string;
  readonly fields: readonly MasterField[];
}

const active: MasterField = { key: 'isActive', label: 'Active', kind: 'toggle', listed: true };

/** The OT masters and their fields, as the backend's record endpoints take them. */
export const OT_MASTERS: readonly MasterDefinition[] = [
  {
    master: 'ot-rooms',
    label: 'OT rooms',
    noun: 'OT room',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true, max: 100, listed: true },
      { key: 'floor', label: 'Floor', kind: 'text', max: 50, listed: true },
      { key: 'description', label: 'Description', kind: 'textarea', max: 300 },
      active,
    ],
  },
  {
    master: 'operations',
    label: 'Operations',
    noun: 'operation',
    fields: [{ key: 'name', label: 'Name', kind: 'text', required: true, max: 150, listed: true }, active],
  },
  {
    master: 'ot-types',
    label: 'OT types',
    noun: 'OT type',
    fields: [{ key: 'name', label: 'Name', kind: 'text', required: true, max: 100, listed: true }],
  },
  {
    master: 'anaesthesia-types',
    label: 'Anaesthesia types',
    noun: 'anaesthesia type',
    fields: [{ key: 'name', label: 'Name', kind: 'text', required: true, max: 100, listed: true }],
  },
  {
    master: 'surgery-procedures',
    label: 'Surgery procedures',
    noun: 'surgery procedure',
    fields: [
      { key: 'title', label: 'Title', kind: 'text', required: true, max: 200, listed: true },
      { key: 'area', label: 'Area', kind: 'text', max: 100, listed: true },
      { key: 'description', label: 'Steps', kind: 'textarea', max: 8000 },
    ],
  },
];

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

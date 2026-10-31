import type { MasterDefinition, MasterField } from '../../../shared/models/record-master';

const active: MasterField = { key: 'isActive', label: 'Active', kind: 'toggle', listed: true };

/** The OT masters and their fields, as the backend's record endpoints take them (`ot:manage` to change). */
export const OT_MASTERS: readonly MasterDefinition[] = [
  {
    path: 'hospital/ot-rooms',
    managePermission: 'ot:manage',
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
    path: 'hospital/operations',
    managePermission: 'ot:manage',
    label: 'Operations',
    noun: 'operation',
    fields: [{ key: 'name', label: 'Name', kind: 'text', required: true, max: 150, listed: true }, active],
  },
  {
    path: 'hospital/ot-types',
    managePermission: 'ot:manage',
    label: 'OT types',
    noun: 'OT type',
    fields: [{ key: 'name', label: 'Name', kind: 'text', required: true, max: 100, listed: true }],
  },
  {
    path: 'hospital/anaesthesia-types',
    managePermission: 'ot:manage',
    label: 'Anaesthesia types',
    noun: 'anaesthesia type',
    fields: [{ key: 'name', label: 'Name', kind: 'text', required: true, max: 100, listed: true }],
  },
  {
    path: 'hospital/surgery-procedures',
    managePermission: 'ot:manage',
    label: 'Surgery procedures',
    noun: 'surgery procedure',
    fields: [
      { key: 'title', label: 'Title', kind: 'text', required: true, max: 200, listed: true },
      { key: 'area', label: 'Area', kind: 'text', max: 100, listed: true },
      { key: 'description', label: 'Steps', kind: 'textarea', max: 8000 },
    ],
  },
];

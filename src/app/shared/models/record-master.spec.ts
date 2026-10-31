import { displayValue, type MasterDefinition, toMasterBody } from './record-master';

const WINDOWS: MasterDefinition = {
  path: 'hospital/test-appointment-windows',
  managePermission: 'diag:manage',
  label: 'Windows',
  noun: 'window',
  fields: [
    { key: 'label', label: 'Name', kind: 'text', required: true },
    { key: 'endTime', label: 'Ends', kind: 'text' },
    { key: 'capacity', label: 'Places', kind: 'number', required: true },
    { key: 'charge', label: 'Charge', kind: 'number', decimals: 2 },
    { key: 'departmentId', label: 'Department', kind: 'select', emptyLabel: 'Any department' },
    {
      key: 'days',
      label: 'Days',
      kind: 'multi',
      options: [
        { value: 'saturday', label: 'Sat' },
        { value: 'sunday', label: 'Sun' },
      ],
      emptyLabel: 'Every day',
    },
    { key: 'isActive', label: 'Active', kind: 'toggle' },
  ],
};
const field = (key: string) => WINDOWS.fields.find((entry) => entry.key === key)!;

describe('record masters', () => {
  it('sends text trimmed, numbers as numbers, choices and lists as the backend takes them', () => {
    expect(
      toMasterBody(WINDOWS, {
        label: ' Morning ',
        endTime: '  ',
        capacity: 20,
        charge: '',
        departmentId: '',
        days: ['saturday'],
        isActive: true,
      }),
    ).toEqual({
      label: 'Morning',
      endTime: null,
      capacity: 20,
      charge: null,
      departmentId: null,
      days: ['saturday'],
      isActive: true,
    });
  });

  it('reads a choice by its label, a list joined, and nothing as what nothing means', () => {
    const departments = [{ value: 'd1', label: 'Pathology' }];
    expect(displayValue(field('departmentId'), 'd1', departments)).toBe('Pathology');
    expect(displayValue(field('departmentId'), null, departments)).toBe('Any department');
    expect(displayValue(field('days'), ['saturday', 'sunday'])).toBe('Sat, Sun');
    expect(displayValue(field('days'), [])).toBe('Every day');
    expect(displayValue(field('charge'), 150)).toBe('150.00');
    expect(displayValue(field('endTime'), null)).toBe('—');
  });
});

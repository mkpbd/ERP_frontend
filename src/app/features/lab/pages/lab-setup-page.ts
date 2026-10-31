import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MasterTable } from '../../../shared/components/master-table';
import { PageHeader } from '../../../shared/components/page-header';
import type { MasterDefinition } from '../../../shared/models/record-master';
import { TestForms } from '../components/test-forms';

const active = { key: 'isActive', label: 'Active', kind: 'toggle', listed: true } as const;

/** The culture masters and the written reports' templates (`lab:manage` to change). */
export const LAB_MASTERS: readonly MasterDefinition[] = [
  {
    path: 'lab/antibiotics',
    managePermission: 'lab:manage',
    label: 'Antibiotics',
    noun: 'antibiotic',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true, max: 100, listed: true },
      { key: 'groupName', label: 'Class', kind: 'text', max: 100, listed: true },
      active,
    ],
  },
  {
    path: 'lab/organisms',
    managePermission: 'lab:manage',
    label: 'Organisms',
    noun: 'organism',
    fields: [{ key: 'name', label: 'Name', kind: 'text', required: true, max: 150, listed: true }, active],
  },
  {
    path: 'lab/growth-types',
    managePermission: 'lab:manage',
    label: 'Growth types',
    noun: 'growth type',
    fields: [{ key: 'name', label: 'Name', kind: 'text', required: true, max: 100, listed: true }],
  },
  {
    path: 'lab/culture-messages',
    managePermission: 'lab:manage',
    label: 'Culture messages',
    noun: 'culture message',
    fields: [
      { key: 'text', label: 'Message', kind: 'textarea', required: true, max: 500, listed: true, rows: 3 },
    ],
  },
  {
    path: 'lab/report-templates',
    managePermission: 'lab:manage',
    label: 'Report templates',
    noun: 'report template',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true, max: 150, listed: true },
      { key: 'description', label: 'Description', kind: 'text', max: 300, listed: true },
      { key: 'body', label: 'Text', kind: 'textarea', required: true, max: 20_000, rows: 14 },
    ],
  },
];

/** How each test is reported, the culture masters and the written reports' templates. */
@Component({
  selector: 'app-lab-setup-page',
  imports: [MatTabsModule, PageHeader, MasterTable, TestForms],
  template: `
    <app-page-header
      title="Lab setup"
      subtitle="How each test is reported, the culture lists and the written reports' templates."
    />
    <mat-tab-group mat-stretch-tabs="false" animationDuration="0ms">
      <mat-tab label="Report forms">
        <div class="pt-4"><app-test-forms /></div>
      </mat-tab>
      @for (definition of masters; track definition.path) {
        <mat-tab [label]="definition.label">
          <div class="pt-4">
            <app-master-table [definition]="definition" />
          </div>
        </mat-tab>
      }
    </mat-tab-group>
  `,
})
export class LabSetupPage {
  protected readonly masters = LAB_MASTERS;
}

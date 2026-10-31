import { Component } from '@angular/core';
import { MasterTable } from '../../../shared/components/master-table';
import { PageHeader } from '../../../shared/components/page-header';
import type { MasterDefinition } from '../../../shared/models/record-master';

/** Old Follow Up Sheet Schedule: the wards' observation rounds, each a window of local time. */
export const ROUNDS: MasterDefinition = {
  path: 'clinical/observation-rounds',
  managePermission: 'rx:manage',
  label: 'Observation rounds',
  noun: 'round',
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true, max: 60, listed: true },
    { key: 'startTime', label: 'From (HH:MM)', kind: 'text', required: true, max: 5, listed: true },
    {
      key: 'endTime',
      label: 'To (HH:MM; before From: the next morning)',
      kind: 'text',
      required: true,
      max: 5,
      listed: true,
    },
    { key: 'isActive', label: 'Active', kind: 'toggle', listed: true },
  ],
};

@Component({
  selector: 'app-rounds-page',
  imports: [PageHeader, MasterTable],
  template: `
    <app-page-header
      title="Observation rounds"
      subtitle="The wards' rounds; an observation counts for the round its time falls in."
    />
    <app-master-table [definition]="rounds" />
  `,
})
export class RoundsPage {
  protected readonly rounds = ROUNDS;
}

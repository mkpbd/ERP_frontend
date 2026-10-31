import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { PageHeader } from '../../../shared/components/page-header';
import { MasterTable } from '../../../shared/components/master-table';
import { OT_MASTERS } from '../models/ot-masters';

/** The OT masters: rooms, operations, OT and anaesthesia types, surgery procedures. */
@Component({
  selector: 'app-ot-setup-page',
  imports: [MatTabsModule, PageHeader, MasterTable],
  template: `
    <app-page-header
      title="OT setup"
      subtitle="Rooms, operations, OT and anaesthesia types, surgery procedures."
    />
    <mat-tab-group mat-stretch-tabs="false" animationDuration="0ms">
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
export class OtSetupPage {
  protected readonly masters = OT_MASTERS;
}

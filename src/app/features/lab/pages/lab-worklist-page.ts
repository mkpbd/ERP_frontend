import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeader } from '../../../shared/components/page-header';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PAGE_SIZE_OPTIONS } from '../../../shared/models/page';
import { CollectDialog } from '../components/collect-dialog';
import { RESULT_LABELS, RESULT_TONES, type ResultStatus, toDay } from '../models/lab.models';
import { LabWorklistStore } from '../state/lab-lists.store';

/** Old pathology result entry and finalisation lists: the tests to enter, to verify, and those done. */
@Component({
  selector: 'app-lab-worklist-page',
  providers: [LabWorklistStore],
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeader,
    EmptyState,
    ErrorState,
    StatusBadge,
    HasPermissionDirective,
  ],
  template: `
    <app-page-header title="Lab worklist" subtitle="Tests to enter, to verify, and those done.">
      <a matButton="outlined" routerLink="/lab/samples">
        <mat-icon>science</mat-icon>
        Samples
      </a>
      <button matButton="filled" type="button" *appHasPermission="'lab:collect'" (click)="collect()">
        <mat-icon>add</mat-icon>
        Collect sample
      </button>
    </app-page-header>

    <div class="app-dense mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <mat-button-toggle-group
        [value]="store.query().status ?? ''"
        (change)="setStatus($event.value)"
        aria-label="Which results"
      >
        <mat-button-toggle value="pending">To enter</mat-button-toggle>
        <mat-button-toggle value="entered">To verify</mat-button-toggle>
        <mat-button-toggle value="verified">Verified</mat-button-toggle>
        <mat-button-toggle value="">All</mat-button-toggle>
      </mat-button-toggle-group>
      <form [formGroup]="period" class="sm:ml-auto">
        <mat-form-field class="sm:w-64">
          <mat-label>Collected</mat-label>
          <mat-date-range-input [rangePicker]="picker">
            <input matStartDate formControlName="from" placeholder="From" />
            <input matEndDate formControlName="to" placeholder="To" />
          </mat-date-range-input>
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-date-range-picker #picker />
        </mat-form-field>
      </form>
    </div>

    @if (store.error(); as error) {
      <app-error-state [error]="error" title="Could not load the worklist" (retry)="store.reload()" />
    } @else if (store.isEmpty()) {
      <app-empty-state icon="biotech" title="Nothing here" message="No results in this list." />
    } @else {
      <div class="app-card relative overflow-hidden">
        <div class="h-1">
          @if (store.loading()) {
            <mat-progress-bar mode="indeterminate" aria-label="Loading the worklist" />
          }
        </div>
        <div class="overflow-x-auto">
          <table mat-table [dataSource]="store.items()" class="min-w-[720px]" aria-label="Lab worklist">
            <ng-container matColumnDef="test">
              <th mat-header-cell *matHeaderCellDef>Test</th>
              <td mat-cell *matCellDef="let row">
                <a [routerLink]="['/lab/results', row.id]" class="font-medium text-primary hover:underline">{{
                  row.testName
                }}</a>
                <div class="text-xs text-on-surface-variant">{{ row.departmentName }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="patient">
              <th mat-header-cell *matHeaderCellDef>Patient</th>
              <td mat-cell *matCellDef="let row">
                {{ row.patientName }}
                <div class="text-xs text-on-surface-variant">UHID {{ row.uhid }} · {{ row.billNumber }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="labNumber">
              <th mat-header-cell *matHeaderCellDef>Lab no</th>
              <td mat-cell *matCellDef="let row">
                <a [routerLink]="['/lab/samples', row.sampleId]" class="font-mono hover:underline">{{
                  row.labNumber
                }}</a>
              </td>
            </ng-container>
            <ng-container matColumnDef="collectedAt">
              <th mat-header-cell *matHeaderCellDef>Collected</th>
              <td mat-cell *matCellDef="let row">{{ row.collectedAt | date: 'short' }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <app-status-badge [label]="label(row.status)" [tone]="tone(row.status)" />
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
        <mat-paginator
          [length]="store.total()"
          [pageIndex]="store.query().page - 1"
          [pageSize]="store.query().pageSize"
          [pageSizeOptions]="pageSizeOptions"
          (page)="page($event)"
          aria-label="Select page of the worklist"
        />
      </div>
    }
  `,
})
export class LabWorklistPage {
  protected readonly store = inject(LabWorklistStore);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = ['test', 'patient', 'labNumber', 'collectedAt', 'status'];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly period = new FormGroup({
    from: new FormControl<Date | null>(null),
    to: new FormControl<Date | null>(null),
  });

  constructor() {
    this.period.valueChanges.pipe(takeUntilDestroyed()).subscribe(({ from, to }) => {
      if (!!from === !!to) this.store.setPeriod(from ? toDay(from) : undefined, to ? toDay(to) : undefined);
    });
  }

  protected label(status: ResultStatus): string {
    return RESULT_LABELS[status];
  }

  protected tone(status: ResultStatus) {
    return RESULT_TONES[status];
  }

  protected setStatus(status: ResultStatus | ''): void {
    this.store.setStatus(status || undefined);
  }

  protected page(event: PageEvent): void {
    this.store.setPage(event.pageIndex, event.pageSize);
  }

  protected collect(): void {
    this.dialog
      .open<CollectDialog, void, { id: string; labNumber: string }>(CollectDialog, {
        width: '36rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((collected) => {
        if (!collected) return;
        this.notifications.success(`Sample ${collected.labNumber} collected.`);
        void this.router.navigate(['/lab/samples', collected.id]);
      });
  }
}

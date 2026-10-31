import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeader } from '../../../shared/components/page-header';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PAGE_SIZE_OPTIONS } from '../../../shared/models/page';
import { CollectDialog } from '../components/collect-dialog';
import { SAMPLE_LABELS, SAMPLE_STATUSES, SAMPLE_TONES, type SampleStatus } from '../models/lab.models';
import { LabSamplesStore } from '../state/lab-lists.store';

/** Old sample collection and acknowledgement lists: samples with their lab numbers, newest first. */
@Component({
  selector: 'app-lab-samples-page',
  providers: [LabSamplesStore],
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeader,
    EmptyState,
    ErrorState,
    StatusBadge,
    HasPermissionDirective,
  ],
  template: `
    <app-page-header title="Lab samples" subtitle="Samples with their lab numbers, newest first.">
      <button matButton="filled" type="button" *appHasPermission="'lab:collect'" (click)="collect()">
        <mat-icon>add</mat-icon>
        Collect sample
      </button>
    </app-page-header>

    <div class="app-dense mb-4">
      <mat-form-field class="sm:w-48">
        <mat-label>Status</mat-label>
        <mat-select
          [value]="store.query().status ?? ''"
          (selectionChange)="store.setStatus($event.value || undefined)"
        >
          <mat-option value="">All</mat-option>
          @for (status of statuses; track status) {
            <mat-option [value]="status">{{ labels[status] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    @if (store.error(); as error) {
      <app-error-state [error]="error" title="Could not load the samples" (retry)="store.reload()" />
    } @else if (store.isEmpty()) {
      <app-empty-state icon="science" title="No samples" />
    } @else {
      <div class="app-card relative overflow-hidden">
        <div class="h-1">
          @if (store.loading()) {
            <mat-progress-bar mode="indeterminate" aria-label="Loading samples" />
          }
        </div>
        <div class="overflow-x-auto">
          <table mat-table [dataSource]="store.items()" class="min-w-[680px]" aria-label="Lab samples">
            <ng-container matColumnDef="labNumber">
              <th mat-header-cell *matHeaderCellDef>Lab no</th>
              <td mat-cell *matCellDef="let row">
                <a
                  [routerLink]="['/lab/samples', row.id]"
                  class="font-mono font-medium text-primary hover:underline"
                  >{{ row.labNumber }}</a
                >
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
            <ng-container matColumnDef="collectedAt">
              <th mat-header-cell *matHeaderCellDef>Collected</th>
              <td mat-cell *matCellDef="let row">{{ row.collectedAt | date: 'short' }}</td>
            </ng-container>
            <ng-container matColumnDef="progress">
              <th mat-header-cell *matHeaderCellDef>Verified</th>
              <td mat-cell *matCellDef="let row">{{ row.verified }} / {{ row.tests }}</td>
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
          aria-label="Select page of samples"
        />
      </div>
    }
  `,
})
export class LabSamplesPage {
  protected readonly store = inject(LabSamplesStore);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = ['labNumber', 'patient', 'collectedAt', 'progress', 'status'];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly statuses = SAMPLE_STATUSES;
  protected readonly labels = SAMPLE_LABELS;

  protected label(status: SampleStatus): string {
    return SAMPLE_LABELS[status];
  }

  protected tone(status: SampleStatus) {
    return SAMPLE_TONES[status];
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

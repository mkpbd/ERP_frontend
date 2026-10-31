import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { ReportDownloadService } from '../../../core/services/report-download.service';
import { PageHeader } from '../../../shared/components/page-header';
import { ReasonDialog, type ReasonDialogData } from '../../../shared/components/reason-dialog';
import { ErrorState, LoadingState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import {
  RESULT_LABELS,
  RESULT_TONES,
  type ResultStatus,
  SAMPLE_LABELS,
  SAMPLE_TONES,
} from '../models/lab.models';
import { LabSampleStore } from '../state/lab-sample.store';

/** One sample: taken in by the lab or rejected, its tests' results, the report printed and handed over. */
@Component({
  selector: 'app-lab-sample-page',
  providers: [LabSampleStore],
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    PageHeader,
    ErrorState,
    LoadingState,
    StatusBadge,
  ],
  template: `
    @if (store.error(); as error) {
      <app-error-state
        [error]="error"
        [title]="error.status === 404 ? 'Sample not found' : 'Could not load the sample'"
        [retryable]="error.status !== 404"
        (retry)="store.reload()"
      />
    } @else if (store.sample(); as sample) {
      <app-page-header
        [title]="'Sample ' + sample.labNumber"
        [subtitle]="
          (sample.patientName ?? '') +
          (sample.uhid ? ' · UHID ' + sample.uhid : '') +
          ' · ' +
          (sample.billNumber ?? '')
        "
      >
        <app-status-badge [label]="sampleLabels[sample.status]" [tone]="sampleTones[sample.status]" />
        @if (store.canReceive()) {
          <button matButton="filled" type="button" (click)="receive()" [disabled]="!!store.pending()">
            <mat-icon>move_to_inbox</mat-icon>
            Take in
          </button>
        }
        @if (store.printable()) {
          <button matButton="outlined" type="button" (click)="print()">
            <mat-icon>print</mat-icon>
            Print report
          </button>
        }
        @if (store.canDeliver()) {
          <button matButton="outlined" type="button" (click)="deliver()" [disabled]="!!store.pending()">
            <mat-icon>outbox</mat-icon>
            Hand over
          </button>
        }
        @if (store.canReject()) {
          <button matButton type="button" (click)="reject()" [disabled]="!!store.pending()">
            <mat-icon>block</mat-icon>
            Reject
          </button>
        }
      </app-page-header>

      @if (sample.status === 'rejected') {
        <p
          class="mb-4 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
          role="status"
        >
          Rejected: {{ sample.rejectReason }}. Its tests are collected again on a new sample.
        </p>
      }

      <dl class="app-card mb-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 p-5 text-sm">
        <dt class="text-on-surface-variant">Department</dt>
        <dd>{{ sample.departmentName ?? '—' }}</dd>
        <dt class="text-on-surface-variant">Collected</dt>
        <dd>{{ sample.collectedAt | date: 'medium' }}</dd>
        <dt class="text-on-surface-variant">Verified</dt>
        <dd>{{ sample.verified }} of {{ sample.tests }} tests</dd>
      </dl>

      <div class="app-card overflow-x-auto">
        <table mat-table [dataSource]="sample.results" class="min-w-[560px]" aria-label="Tests of the sample">
          <ng-container matColumnDef="test">
            <th mat-header-cell *matHeaderCellDef>Test</th>
            <td mat-cell *matCellDef="let row">
              <a [routerLink]="['/lab/results', row.id]" class="font-medium text-primary hover:underline">{{
                row.testName
              }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-badge [label]="resultLabel(row.status)" [tone]="resultTone(row.status)" />
            </td>
          </ng-container>
          <ng-container matColumnDef="verifiedAt">
            <th mat-header-cell *matHeaderCellDef>Verified</th>
            <td mat-cell *matCellDef="let row">
              {{ row.verifiedAt ? (row.verifiedAt | date: 'short') : '—' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="deliveredTo">
            <th mat-header-cell *matHeaderCellDef>Handed to</th>
            <td mat-cell *matCellDef="let row">{{ row.deliveredTo ?? '—' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    } @else if (store.loading()) {
      <app-loading-state label="Loading the sample…" />
    }
  `,
})
export class LabSamplePage {
  protected readonly store = inject(LabSampleStore);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly reports = inject(ReportDownloadService);

  protected readonly sampleLabels = SAMPLE_LABELS;
  protected readonly sampleTones = SAMPLE_TONES;
  protected readonly columns = ['test', 'status', 'verifiedAt', 'deliveredTo'];

  protected resultLabel(status: ResultStatus): string {
    return RESULT_LABELS[status];
  }

  protected resultTone(status: ResultStatus) {
    return RESULT_TONES[status];
  }

  protected receive(): void {
    this.store.receive().subscribe({
      next: () => this.notifications.success('Sample taken in.'),
      error: (error: unknown) => this.notifications.error(error),
    });
  }

  protected reject(): void {
    this.dialog
      .open<ReasonDialog, ReasonDialogData, true>(ReasonDialog, {
        data: {
          title: 'Reject the sample?',
          message:
            'Its tests not yet verified are freed to be collected again on a new sample and lab number.',
          confirmText: 'Reject sample',
          submit: (reason) => this.store.reject(reason),
        },
        width: '28rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notifications.success('Sample rejected.');
      });
  }

  protected deliver(): void {
    this.dialog
      .open<ReasonDialog, ReasonDialogData, true>(ReasonDialog, {
        data: {
          title: 'Hand over the reports?',
          message:
            'The verified reports of this sample are handed over. A report is held while the patient owes.',
          confirmText: 'Hand over',
          label: 'Collected by',
          destructive: false,
          submit: (to) => this.store.deliver(to),
        },
        width: '28rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notifications.success('Reports handed over.');
      });
  }

  protected print(): void {
    const sample = this.store.sample();
    if (!sample) return;
    this.reports
      .download('laboratory.lab-report', { sampleId: sample.id }, `lab-report-${sample.labNumber}`)
      .subscribe({ error: (error: unknown) => this.notifications.error(error) });
  }
}

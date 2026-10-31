import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { map, tap } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { ReportDownloadService } from '../../../core/services/report-download.service';
import { ReasonDialog, type ReasonDialogData } from '../../../shared/components/reason-dialog';
import { bloodPressure, FLAG_LABELS, type Observation, type VitalFlag } from '../models/nursing.models';
import { StayNursingStore } from '../state/stay-nursing.store';
import { ObservationDialog, type ObservationDialogData } from './observation-dialog';

/** Old follow-up sheet: the day's readings, the ones to report flagged, entries struck through when wrong. */
@Component({
  selector: 'app-observation-sheet',
  imports: [DatePipe, MatButtonModule, MatIconModule],
  template: `
    <div class="mb-3 flex flex-wrap items-center gap-2">
      @if (store.canWrite()) {
        <button matButton="tonal" type="button" (click)="record()" data-testid="record-observation">
          <mat-icon>add</mat-icon>
          Record observation
        </button>
      }
      <button matButton type="button" (click)="print()">
        <mat-icon>print</mat-icon>
        Print the day's sheet
      </button>
    </div>
    <div class="app-card overflow-x-auto">
      <table class="w-full min-w-[820px] text-sm" aria-label="Observation sheet">
        <thead>
          <tr class="border-b border-outline-variant text-left">
            <th class="px-3 py-2 font-medium">Taken</th>
            <th class="py-2 font-medium">Round</th>
            <th class="py-2 font-medium">Temp °F</th>
            <th class="py-2 font-medium">Pulse</th>
            <th class="py-2 font-medium">RR</th>
            <th class="py-2 font-medium">BP</th>
            <th class="py-2 font-medium">SpO2</th>
            <th class="py-2 font-medium">Pain</th>
            <th class="py-2 font-medium">Sugar</th>
            <th class="py-2 font-medium">In/out</th>
            <th class="py-2 font-medium">Note</th>
            <th class="py-2 font-medium">By</th>
            <th class="w-10"><span class="app-sr-only">Strike</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of store.observations(); track row.id) {
            <tr
              class="border-b border-outline-variant align-top"
              [class.line-through]="row.struckAt"
              [class.opacity-60]="row.struckAt"
            >
              <td class="px-3 py-2">{{ row.takenAt | date: 'shortTime' }}</td>
              <td class="py-2">{{ row.roundName ?? '—' }}</td>
              <td class="py-2">{{ row.temperatureF }}</td>
              <td class="py-2">{{ row.pulse }}</td>
              <td class="py-2">{{ row.respRate }}</td>
              <td class="py-2">{{ bp(row) }}</td>
              <td class="py-2">{{ row.spo2 }}</td>
              <td class="py-2">{{ row.painScore }}</td>
              <td class="py-2">{{ row.bloodSugar }}</td>
              <td class="py-2">{{ row.intakeMl }}{{ row.outputMl !== null ? ' / ' + row.outputMl : '' }}</td>
              <td class="py-2">
                @for (flag of row.flags; track flag) {
                  <span
                    class="mr-1 inline-block rounded-pill bg-error-container px-2 text-xs text-on-error-container"
                    >{{ flagLabel(flag) }}</span
                  >
                }
                {{ row.note }}
                @if (row.struckAt) {
                  <div class="text-xs no-underline">
                    Struck by {{ row.struckByName }}: {{ row.struckReason }}
                  </div>
                }
              </td>
              <td class="py-2">{{ row.recordedByName }}</td>
              <td class="py-1">
                @if (!row.struckAt && store.canWrite()) {
                  <button
                    matIconButton
                    type="button"
                    [attr.aria-label]="'Strike the reading at ' + (row.takenAt | date: 'shortTime')"
                    (click)="strike(row)"
                  >
                    <mat-icon>strikethrough_s</mat-icon>
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="13" class="px-3 py-3 text-on-surface-variant">No observation on this day.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ObservationSheet {
  protected readonly store = inject(StayNursingStore);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly reports = inject(ReportDownloadService);

  protected readonly bp = bloodPressure;

  protected flagLabel(flag: VitalFlag): string {
    return FLAG_LABELS[flag];
  }

  protected record(): void {
    this.dialog
      .open<ObservationDialog, ObservationDialogData, { id: string; flags: VitalFlag[] }>(ObservationDialog, {
        width: '40rem',
        maxWidth: '95vw',
        data: {
          patientName: this.store.admission()?.patientName ?? '',
          submit: (observation) => {
            let saved = { id: '', flags: [] as VitalFlag[] };
            return this.store
              .act((id) => this.store.api.record(id, observation).pipe(tap((result) => (saved = result))))
              .pipe(map(() => saved));
          },
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        const flags = result.flags.map((flag) => FLAG_LABELS[flag]).join(', ');
        if (flags) this.notifications.error(`Recorded. Tell the doctor: ${flags}.`);
        else this.notifications.success('Observation recorded.');
      });
  }

  protected strike(row: Observation): void {
    this.dialog
      .open<ReasonDialog, ReasonDialogData, true>(ReasonDialog, {
        width: '28rem',
        maxWidth: '95vw',
        data: {
          title: 'Strike the reading through?',
          message: 'It stays on the sheet, struck through, and no longer counts.',
          confirmText: 'Strike through',
          label: 'Why it was wrong',
          submit: (reason) => this.store.act(() => this.store.api.strike(row.id, reason)),
        },
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notifications.success('Struck through.');
      });
  }

  protected print(): void {
    const day = this.store.day();
    this.reports
      .download(
        'clinical.observation-chart',
        { admissionId: this.store.admissionId(), from: day, to: day },
        `observations-${day}`,
      )
      .subscribe({ error: (error: unknown) => this.notifications.error(error) });
  }
}

import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { Authorization } from '../../../core/authorization/authorization.service';
import { toApiError } from '../../../core/http/api-error';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeader } from '../../../shared/components/page-header';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { ObservationDialog, type ObservationDialogData } from '../components/observation-dialog';
import {
  FLAG_LABELS,
  ROUND_LABELS,
  ROUND_TONES,
  type RoundState,
  toDay,
  type VitalFlag,
} from '../models/nursing.models';
import { NursingApi } from '../services/nursing-api.service';

/** The wards' observation board: every admitted patient, each round of the day done, due, missed or to come. */
@Component({
  selector: 'app-observation-board-page',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    PageHeader,
    EmptyState,
    ErrorState,
    StatusBadge,
    HasPermissionDirective,
  ],
  template: `
    <app-page-header
      title="Observation rounds"
      subtitle="Each admitted patient's rounds of the day, and readings to report."
    >
      <a matButton="outlined" routerLink="/nursing/rounds" *appHasPermission="'rx:manage'">
        <mat-icon>schedule</mat-icon>
        Rounds
      </a>
    </app-page-header>
    <div class="app-dense mb-2 flex items-center gap-2">
      <mat-form-field class="w-44">
        <mat-label>Day</mat-label>
        <input matInput [matDatepicker]="picker" [value]="date()" (dateChange)="pickDay($event)" />
        <mat-datepicker-toggle matIconSuffix [for]="picker" />
        <mat-datepicker #picker />
      </mat-form-field>
    </div>
    <div class="h-1">
      @if (board.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading the board" />
      }
    </div>
    @if (error(); as error) {
      <app-error-state [error]="error" title="Could not load the board" (retry)="board.reload()" />
    } @else if (view(); as view) {
      @if (view.rounds.length === 0) {
        <app-empty-state
          icon="schedule"
          title="No rounds set"
          message="Set the wards' observation rounds first."
        />
      } @else if (view.patients.length === 0) {
        <app-empty-state icon="hotel" title="No patient is admitted" />
      } @else {
        <div class="app-card overflow-x-auto">
          <table class="w-full min-w-[760px] text-sm" aria-label="Observation board">
            <thead>
              <tr class="border-b border-outline-variant text-left">
                <th class="px-3 py-2 font-medium">Bed</th>
                <th class="py-2 font-medium">Patient</th>
                @for (round of view.rounds; track round.id) {
                  <th class="py-2 font-medium">
                    {{ round.name }}
                    <div class="text-xs font-normal">{{ round.startTime }}–{{ round.endTime }}</div>
                  </th>
                }
                <th class="py-2 font-medium">Last reading</th>
                <th class="w-28"><span class="app-sr-only">Record</span></th>
              </tr>
            </thead>
            <tbody>
              @for (patient of view.patients; track patient.admissionId) {
                <tr class="border-b border-outline-variant align-top">
                  <td class="px-3 py-2">{{ patient.wardName }} · {{ patient.bedCode }}</td>
                  <td class="py-2">
                    <a
                      [routerLink]="['/nursing/admissions', patient.admissionId]"
                      class="font-medium text-primary hover:underline"
                      >{{ patient.patientName }}</a
                    >
                    <div class="text-xs text-on-surface-variant">UHID {{ patient.uhid }}</div>
                  </td>
                  @for (state of patient.rounds; track $index) {
                    <td class="py-2">
                      @if (state) {
                        <app-status-badge [label]="roundLabel(state)" [tone]="roundTone(state)" />
                      } @else {
                        <span class="text-on-surface-variant">—</span>
                      }
                    </td>
                  }
                  <td class="py-2">
                    {{ patient.lastAt ? (patient.lastAt | date: 'short') : '—' }}
                    @for (flag of patient.lastFlags; track flag) {
                      <span
                        class="ml-1 inline-block rounded-pill bg-error-container px-2 text-xs text-on-error-container"
                        >{{ flagLabel(flag) }}</span
                      >
                    }
                  </td>
                  <td class="py-1">
                    @if (canWrite() && isToday()) {
                      <button
                        matButton
                        type="button"
                        (click)="record(patient.admissionId, patient.patientName)"
                      >
                        Record
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
})
export class ObservationBoardPage {
  private readonly api = inject(NursingApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifications = inject(NotificationService);
  private readonly authorization = inject(Authorization);

  protected readonly day = signal(toDay(new Date()));
  protected readonly date = computed(() => new Date(`${this.day()}T00:00:00`));
  protected readonly isToday = computed(() => this.day() === toDay(new Date()));
  protected readonly canWrite = computed(() => this.authorization.can('emr:write'));
  protected readonly board = rxResource({
    params: () => this.day(),
    stream: ({ params }) => this.api.board(params),
  });
  protected readonly view = computed(() => (this.board.hasValue() ? this.board.value() : null));
  protected readonly error = computed(() => {
    const error = this.board.error();
    return error ? toApiError(error) : null;
  });

  protected roundLabel(state: RoundState): string {
    return ROUND_LABELS[state];
  }

  protected roundTone(state: RoundState) {
    return ROUND_TONES[state];
  }

  protected flagLabel(flag: VitalFlag): string {
    return FLAG_LABELS[flag];
  }

  protected pickDay(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) this.day.set(toDay(event.value));
  }

  protected record(admissionId: string, patientName: string): void {
    this.dialog
      .open<ObservationDialog, ObservationDialogData, { id: string; flags: VitalFlag[] }>(ObservationDialog, {
        width: '40rem',
        maxWidth: '95vw',
        data: { patientName, submit: (observation) => this.api.record(admissionId, observation) },
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.board.reload();
        const flags = result.flags.map((flag) => FLAG_LABELS[flag]).join(', ');
        if (flags) this.notifications.error(`Recorded. Tell the doctor: ${flags}.`);
        else this.notifications.success('Observation recorded.');
      });
  }
}

import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { filter, switchMap } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { ReportDownloadService } from '../../../core/services/report-download.service';
import { ConfirmService } from '../../../shared/components/confirm-dialog';
import { PageHeader } from '../../../shared/components/page-header';
import { ErrorState, LoadingState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { ChargeDialog, type ChargeDialogData } from '../components/charge-dialog';
import { MomentDialog, type MomentDialogData } from '../components/moment-dialog';
import { ReasonDialog, type ReasonDialogData } from '../components/reason-dialog';
import { RequestOtDialog, type RequestOtDialogData } from '../components/request-ot-dialog';
import { ScheduleOtDialog, type ScheduleOtDialogData } from '../components/schedule-ot-dialog';
import { type OtCharge, type OtNote, ROLE_LABELS, STATUS_LABELS, STATUS_TONES } from '../models/ot.models';
import { OtCaseStore } from '../state/ot-case.store';

const NOTE_FIELDS: readonly { key: keyof OtNote; label: string; rows: number; max: number }[] = [
  { key: 'incision', label: 'Incision', rows: 1, max: 500 },
  { key: 'findings', label: 'Findings', rows: 4, max: 8000 },
  { key: 'procedureDone', label: 'Procedure done', rows: 6, max: 8000 },
  { key: 'specimen', label: 'Specimen sent', rows: 2, max: 1000 },
  { key: 'postOpOrders', label: 'Post-operative orders', rows: 4, max: 4000 },
];

/** One operation: who and what, its room and times, the operation note, and its charges. */
@Component({
  selector: 'app-ot-case-detail-page',
  providers: [OtCaseStore],
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatTableModule,
    PageHeader,
    ErrorState,
    LoadingState,
    StatusBadge,
    HasPermissionDirective,
    ValidationMessagePipe,
  ],
  template: `
    @if (store.error(); as error) {
      <app-error-state
        [error]="error"
        [title]="error.status === 404 ? 'Operation not found' : 'Could not load the operation'"
        [retryable]="error.status !== 404"
        (retry)="store.reload()"
      />
    } @else if (store.otCase(); as ot) {
      <app-page-header
        [title]="ot.operationName"
        [subtitle]="ot.number + ' · ' + ot.patientName + ' (UHID ' + ot.uhid + ')'"
      >
        <app-status-badge [label]="labels[ot.status]" [tone]="tones[ot.status]" />
        @if (store.canSchedule()) {
          <button matButton="outlined" type="button" (click)="schedule()" [disabled]="!!store.pending()">
            <mat-icon>event</mat-icon>
            {{ ot.otRoomId ? 'Move' : 'Schedule' }}
          </button>
        }
        @if (store.canStart()) {
          <button matButton="filled" type="button" (click)="move('start')" [disabled]="!!store.pending()">
            <mat-icon>play_arrow</mat-icon>
            Start
          </button>
        }
        @if (store.canFinish()) {
          <button matButton="filled" type="button" (click)="move('finish')" [disabled]="!!store.pending()">
            <mat-icon>check</mat-icon>
            Finish
          </button>
        }
        <button matIconButton type="button" [matMenuTriggerFor]="more" aria-label="More actions">
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #more="matMenu">
          @if (store.canChange()) {
            <button mat-menu-item type="button" (click)="change()">
              <mat-icon>edit</mat-icon>
              Change operation or team
            </button>
          }
          <button mat-menu-item type="button" (click)="print('hospital.ot-note', 'note')">
            <mat-icon>description</mat-icon>
            Print operation note
          </button>
          @if (ot.status !== 'cancelled') {
            <button mat-menu-item type="button" (click)="print('hospital.ot-consent', 'consent')">
              <mat-icon>draw</mat-icon>
              Print consent
            </button>
          }
          @if (store.canCancel()) {
            <button mat-menu-item type="button" (click)="cancel()">
              <mat-icon>cancel</mat-icon>
              Cancel operation
            </button>
          }
        </mat-menu>
      </app-page-header>

      @if (ot.status === 'cancelled') {
        <p class="mb-4 rounded-card bg-surface-container-high px-4 py-3 text-sm" role="status">
          Cancelled: {{ ot.cancelReason }}
        </p>
      }

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="app-card p-5" aria-labelledby="ot-heading">
          <h2 id="ot-heading" class="mb-4 text-lg font-medium">Operation</h2>
          <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt class="text-on-surface-variant">Stay</dt>
            <dd>{{ ot.admissionNumber }}</dd>
            <dt class="text-on-surface-variant">OT type</dt>
            <dd>{{ ot.otTypeName ?? '—' }}</dd>
            <dt class="text-on-surface-variant">Anaesthesia</dt>
            <dd>{{ ot.anaesthesiaTypeName ?? '—' }}</dd>
            <dt class="text-on-surface-variant">Surgeon</dt>
            <dd>{{ ot.surgeonName }}</dd>
            <dt class="text-on-surface-variant">Anaesthetist</dt>
            <dd>{{ ot.anaesthetistName ?? '—' }}</dd>
            @for (member of ot.team; track member.doctorId) {
              <dt class="text-on-surface-variant">{{ roleLabels[member.role] }}</dt>
              <dd>{{ member.doctorName }}</dd>
            }
            <dt class="text-on-surface-variant">Indication</dt>
            <dd class="whitespace-pre-line">{{ ot.indication ?? '—' }}</dd>
          </dl>
        </section>

        <section class="app-card p-5" aria-labelledby="time-heading">
          <h2 id="time-heading" class="mb-4 text-lg font-medium">Room and time</h2>
          <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt class="text-on-surface-variant">Asked for</dt>
            <dd>{{ ot.requestedFor | date: 'fullDate' }}</dd>
            <dt class="text-on-surface-variant">Room</dt>
            <dd>{{ ot.otRoomName ?? 'Not given yet' }}</dd>
            <dt class="text-on-surface-variant">Booked</dt>
            <dd>
              @if (ot.scheduledFrom) {
                {{ ot.scheduledFrom | date: 'medium' }} – {{ ot.scheduledTo | date: 'shortTime' }}
              } @else {
                —
              }
            </dd>
            <dt class="text-on-surface-variant">Started</dt>
            <dd>{{ ot.startedAt ? (ot.startedAt | date: 'medium') : '—' }}</dd>
            <dt class="text-on-surface-variant">Finished</dt>
            <dd>{{ ot.endedAt ? (ot.endedAt | date: 'medium') : '—' }}</dd>
          </dl>
        </section>

        <section class="app-card p-5 lg:col-span-2" aria-labelledby="note-heading">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="note-heading" class="text-lg font-medium">Operation note</h2>
            @if (ot.noteSignedAt) {
              <span class="text-sm text-on-surface-variant">
                Signed by {{ ot.noteSignedByName }} on {{ ot.noteSignedAt | date: 'medium' }}
              </span>
            } @else if (ot.status === 'requested' || ot.status === 'scheduled') {
              <span class="text-sm text-on-surface-variant">Written once the operation has started.</span>
            }
          </div>
          @if (store.canWriteNote()) {
            <form [formGroup]="note" (ngSubmit)="saveNote()" novalidate class="flex flex-col gap-1">
              @for (field of noteFields; track field.key) {
                <mat-form-field>
                  <mat-label>{{ field.label }}</mat-label>
                  <textarea matInput [formControlName]="field.key" [rows]="field.rows"></textarea>
                  <mat-error>{{
                    note.controls[field.key].errors | validationMessage: field.label
                  }}</mat-error>
                </mat-form-field>
              }
              <div class="flex flex-wrap justify-end gap-2">
                <button matButton="filled" type="submit" [disabled]="note.pristine || !!store.pending()">
                  Save note
                </button>
                @if (ot.status === 'done') {
                  <button
                    matButton="outlined"
                    type="button"
                    (click)="sign()"
                    [disabled]="!store.canSign() || !note.pristine || !!store.pending()"
                    title="The surgeon signs once the procedure is written and saved."
                  >
                    <mat-icon>verified</mat-icon>
                    Sign
                  </button>
                }
              </div>
            </form>
          } @else {
            <dl class="grid gap-y-3 text-sm">
              @for (field of noteFields; track field.key) {
                <div>
                  <dt class="text-on-surface-variant">{{ field.label }}</dt>
                  <dd class="whitespace-pre-line">{{ ot[field.key] ?? '—' }}</dd>
                </div>
              }
            </dl>
          }
        </section>

        <section class="app-card p-5 lg:col-span-2" aria-labelledby="charges-heading">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="charges-heading" class="text-lg font-medium">Charges</h2>
            @if (store.canCharge()) {
              <button
                matButton="tonal"
                type="button"
                *appHasPermission="'opd:read'"
                (click)="charge()"
                [disabled]="!!store.pending()"
              >
                <mat-icon>add</mat-icon>
                Add charge
              </button>
            }
          </div>
          @if (ot.charges.length === 0) {
            <p class="text-sm text-on-surface-variant">
              No charges yet. Charges for the operation go on the stay's bill, each with its doctor's share.
            </p>
          } @else {
            <div class="overflow-x-auto">
              <table mat-table [dataSource]="ot.charges" class="min-w-[560px]" aria-label="Charges">
                <ng-container matColumnDef="service">
                  <th mat-header-cell *matHeaderCellDef>Service</th>
                  <td mat-cell *matCellDef="let row" [class.line-through]="row.status === 'cancelled'">
                    {{ row.serviceName }}
                  </td>
                </ng-container>
                <ng-container matColumnDef="doctor">
                  <th mat-header-cell *matHeaderCellDef>Doctor</th>
                  <td mat-cell *matCellDef="let row">{{ row.doctorName ?? '—' }}</td>
                </ng-container>
                <ng-container matColumnDef="qty">
                  <th mat-header-cell *matHeaderCellDef class="text-right">Qty</th>
                  <td mat-cell *matCellDef="let row" class="text-right">{{ row.qty }}</td>
                </ng-container>
                <ng-container matColumnDef="amount">
                  <th mat-header-cell *matHeaderCellDef class="text-right">Amount</th>
                  <td mat-cell *matCellDef="let row" class="text-right">
                    {{ row.amount | currency: 'BDT' : 'symbol-narrow' }}
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef><span class="app-sr-only">Actions</span></th>
                  <td mat-cell *matCellDef="let row" class="text-right">
                    @if (row.status === 'active' && store.canCharge()) {
                      <button
                        matIconButton
                        type="button"
                        [attr.aria-label]="'Cancel charge ' + row.serviceName"
                        (click)="cancelCharge(row)"
                        [disabled]="!!store.pending()"
                      >
                        <mat-icon>remove_circle_outline</mat-icon>
                      </button>
                    } @else if (row.status === 'cancelled') {
                      <span class="text-xs text-on-surface-variant">Cancelled</span>
                    }
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="chargeColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: chargeColumns"></tr>
              </table>
            </div>
            <p class="mt-3 text-right text-sm font-medium">
              Total {{ ot.chargedTotal | currency: 'BDT' : 'symbol-narrow' }}
            </p>
          }
        </section>
      </div>
    } @else if (store.loading()) {
      <app-loading-state label="Loading the operation…" />
    }
  `,
})
export class OtCaseDetailPage {
  protected readonly store = inject(OtCaseStore);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);
  private readonly reports = inject(ReportDownloadService);

  protected readonly labels = STATUS_LABELS;
  protected readonly tones = STATUS_TONES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly noteFields = NOTE_FIELDS;
  protected readonly chargeColumns = ['service', 'doctor', 'qty', 'amount', 'actions'];

  protected readonly note = inject(NonNullableFormBuilder).group(
    Object.fromEntries(
      NOTE_FIELDS.map((field) => [field.key, ['', Validators.maxLength(field.max)]]),
    ) as Record<keyof OtNote, [string, ReturnType<typeof Validators.maxLength>]>,
  );

  constructor() {
    // Sync the note form with the loaded operation (after a save or a reload).
    effect(() => {
      const ot = this.store.otCase();
      if (!ot) return;
      this.note.reset(
        Object.fromEntries(NOTE_FIELDS.map((field) => [field.key, ot[field.key] ?? ''])) as Record<
          keyof OtNote,
          string
        >,
      );
    });
  }

  protected change(): void {
    const ot = this.store.otCase();
    if (!ot) return;
    this.dialog
      .open<RequestOtDialog, RequestOtDialogData, { id: string } | true>(RequestOtDialog, {
        data: { mode: 'change', otCase: ot, submit: (request) => this.store.change(request) },
        width: '44rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notifications.success('Operation changed.');
      });
  }

  protected schedule(): void {
    const ot = this.store.otCase();
    if (!ot) return;
    this.dialog
      .open<ScheduleOtDialog, ScheduleOtDialogData, true>(ScheduleOtDialog, {
        data: { otCase: ot, submit: (roomId, from, to) => this.store.schedule(roomId, from, to) },
        width: '28rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notifications.success(ot.otRoomId ? 'Operation moved.' : 'Operation scheduled.');
      });
  }

  protected move(step: 'start' | 'finish'): void {
    const start = step === 'start';
    this.dialog
      .open<MomentDialog, MomentDialogData, true>(MomentDialog, {
        data: {
          title: start ? 'Start the operation?' : 'Finish the operation?',
          message: start
            ? 'Once under way it can no longer be cancelled, only finished.'
            : 'The surgeon can then sign the operation note.',
          confirmText: start ? 'Start' : 'Finish',
          submit: (at) => (start ? this.store.start(at) : this.store.finish(at)),
        },
        width: '26rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notifications.success(start ? 'Operation started.' : 'Operation finished.');
      });
  }

  protected cancel(): void {
    this.dialog
      .open<ReasonDialog, ReasonDialogData, true>(ReasonDialog, {
        data: {
          title: 'Cancel the operation?',
          message:
            'Its room is free again. A cancelled operation cannot be scheduled again; request a new one.',
          confirmText: 'Cancel operation',
          submit: (reason) => this.store.cancel(reason),
        },
        width: '28rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notifications.success('Operation cancelled.');
      });
  }

  protected saveNote(): void {
    if (this.note.invalid || this.store.pending()) return;
    const value = this.note.getRawValue();
    const note = Object.fromEntries(
      NOTE_FIELDS.map((field) => [field.key, value[field.key].trim() ? value[field.key] : null]),
    ) as unknown as OtNote;
    this.store.writeNote(note).subscribe({
      next: () => this.notifications.success('Operation note saved.'),
      error: (error: unknown) => this.notifications.error(error),
    });
  }

  protected sign(): void {
    this.confirm
      .confirm({
        title: 'Sign the operation note?',
        message: 'Once signed the note can no longer be changed. Only the surgeon can sign.',
        confirmText: 'Sign',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.store.signNote()),
      )
      .subscribe({
        next: () => this.notifications.success('Operation note signed.'),
        error: (error: unknown) => this.notifications.error(error),
      });
  }

  protected charge(): void {
    const ot = this.store.otCase();
    if (!ot) return;
    this.dialog
      .open<ChargeDialog, ChargeDialogData, true>(ChargeDialog, {
        data: { otCase: ot, submit: (request) => this.store.charge(request) },
        width: '32rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notifications.success('Charge added to the stay.');
      });
  }

  protected cancelCharge(charge: OtCharge): void {
    this.dialog
      .open<ReasonDialog, ReasonDialogData, true>(ReasonDialog, {
        data: {
          title: `Cancel the charge "${charge.serviceName}"?`,
          message: 'It comes off the stay before the final bill.',
          confirmText: 'Cancel charge',
          submit: (reason) => this.store.cancelCharge(charge.id, reason),
        },
        width: '28rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notifications.success('Charge cancelled.');
      });
  }

  protected print(key: string, what: string): void {
    const ot = this.store.otCase();
    if (!ot) return;
    this.reports
      .download(key, { id: ot.id }, `${ot.number}-${what}`)
      .subscribe({ error: (error: unknown) => this.notifications.error(error) });
  }
}

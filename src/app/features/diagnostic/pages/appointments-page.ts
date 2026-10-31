import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Authorization } from '../../../core/authorization/authorization.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ReportDownloadService } from '../../../core/services/report-download.service';
import { PageHeader } from '../../../shared/components/page-header';
import { ReasonDialog, type ReasonDialogData } from '../../../shared/components/reason-dialog';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { BillBookingDialog, type BillBookingResult } from '../components/bill-booking-dialog';
import { BookAppointmentDialog, type BookAppointmentDialogData } from '../components/book-appointment-dialog';
import {
  APPOINTMENT_LABELS,
  APPOINTMENT_TONES,
  type BillableBooking,
  fromDay,
  type TestAppointment,
  toDay,
  windowTime,
} from '../models/diagnostic.models';
import { DiagnosticApi } from '../services/diagnostic-api.service';
import { AppointmentBoardStore } from '../state/booking-boards.store';

const WIDE = { width: '44rem', maxWidth: '95vw' } as const;

/** Old test appointment dashboard: a day's bookings by window and serial, with the windows' places and counts. */
@Component({
  selector: 'app-appointments-page',
  providers: [AppointmentBoardStore],
  imports: [
    CurrencyPipe,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
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
    <app-page-header
      title="Test appointments"
      subtitle="Tests booked for a day and window, at the desk or on the portal; billed when the patient comes."
    >
      <a matButton="outlined" routerLink="/diagnostic/setup">
        <mat-icon>edit_calendar</mat-icon>
        Windows
      </a>
      <button
        matButton="filled"
        type="button"
        *appHasPermission="'diag:book'"
        (click)="book()"
        data-testid="book-tests"
      >
        <mat-icon>add</mat-icon>
        Book tests
      </button>
    </app-page-header>

    <div class="app-dense mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Day">
      <button matIconButton type="button" aria-label="Previous day" (click)="store.shift(-1)">
        <mat-icon>chevron_left</mat-icon>
      </button>
      <mat-form-field class="w-44">
        <mat-label>Day</mat-label>
        <input matInput [matDatepicker]="picker" [value]="day()" (dateChange)="pickDay($event)" />
        <mat-datepicker-toggle matIconSuffix [for]="picker" />
        <mat-datepicker #picker />
      </mat-form-field>
      <button matIconButton type="button" aria-label="Next day" (click)="store.shift(1)">
        <mat-icon>chevron_right</mat-icon>
      </button>
      @if (!store.isToday()) {
        <button matButton type="button" (click)="store.today()">Today</button>
      }
      <mat-form-field class="w-52">
        <mat-label>Department</mat-label>
        <mat-select [value]="store.departmentId()" (valueChange)="store.departmentId.set($event)">
          <mat-option [value]="null">All departments</mat-option>
          @for (department of departments(); track department.id) {
            <mat-option [value]="department.id">{{ department.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    <div class="h-1">
      @if (store.loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading the bookings" />
      }
    </div>

    @if (store.windows().length) {
      <ul class="mb-4 flex flex-wrap gap-2" aria-label="Windows of the day">
        @for (window of store.windows(); track window.id) {
          <li
            class="rounded-card border border-outline-variant px-3 py-2 text-sm"
            [class.opacity-60]="window.over"
            [attr.data-testid]="'window-' + window.label"
          >
            <span class="font-medium">{{ window.label }}</span>
            <span class="text-on-surface-variant"> · {{ time(window) }}</span>
            <span class="block text-xs" [class.text-error]="window.left === 0">
              {{ window.booked }} of {{ window.capacity }} booked{{ window.over ? ' · over' : '' }}
            </span>
          </li>
        }
      </ul>
    }

    @if (store.error(); as error) {
      <app-error-state [error]="error" title="Could not load the bookings" (retry)="store.reload()" />
    } @else if (store.board(); as board) {
      <p class="mb-3 text-sm text-on-surface-variant" data-testid="appointment-summary">
        {{ board.summary.booked }} booked · {{ board.summary.billed }} billed ·
        {{ board.summary.noShow }} no-show · {{ board.summary.cancelled }} cancelled ·
        {{ board.summary.amount | currency: 'BDT' : '৳ ' }} quoted
      </p>
      @if (board.items.length === 0) {
        <app-empty-state icon="event_available" title="No test booked for this day" />
      } @else {
        <div class="app-card overflow-x-auto">
          <table mat-table [dataSource]="board.items" aria-label="Test appointments">
            <ng-container matColumnDef="window">
              <th mat-header-cell *matHeaderCellDef>Window</th>
              <td mat-cell *matCellDef="let row">
                <span class="font-medium">{{ row.windowLabel }}</span>
                <span class="block text-xs text-on-surface-variant">{{ time(row) }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="serial">
              <th mat-header-cell *matHeaderCellDef>Serial</th>
              <td mat-cell *matCellDef="let row" class="text-center font-mono font-medium">
                {{ row.serial }}
              </td>
            </ng-container>
            <ng-container matColumnDef="patient">
              <th mat-header-cell *matHeaderCellDef>Patient</th>
              <td mat-cell *matCellDef="let row">
                {{ row.patientName }}
                <span class="block text-xs text-on-surface-variant">
                  {{ row.uhid ? 'UHID ' + row.uhid + ' · ' : 'Not registered · ' }}{{ row.mobileNo }}
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="tests">
              <th mat-header-cell *matHeaderCellDef>Tests</th>
              <td mat-cell *matCellDef="let row">
                {{ testNames(row) }}
                <span class="block text-xs text-on-surface-variant">
                  {{ row.number }} ·
                  {{ row.bookedVia === 'portal' ? 'portal' : (row.bookedByName ?? 'desk') }}
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef class="text-right">Quoted</th>
              <td mat-cell *matCellDef="let row" class="text-right tabular-nums">
                {{ row.amount | currency: 'BDT' : '৳ ' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <app-status-badge [label]="label(row)" [tone]="tone(row)" />
                @if (row.billNumber) {
                  <span class="block text-xs text-on-surface-variant">{{ row.billNumber }}</span>
                }
                @if (row.statusReason) {
                  <span class="block text-xs text-on-surface-variant">{{ row.statusReason }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef><span class="app-sr-only">Actions</span></th>
              <td mat-cell *matCellDef="let row" class="whitespace-nowrap text-right">
                @if (row.status === 'booked') {
                  @if (canBill && row.appointmentDate === today()) {
                    <button
                      matButton="tonal"
                      type="button"
                      (click)="bill(row)"
                      [attr.aria-label]="'Bill ' + row.number"
                    >
                      Bill
                    </button>
                  }
                  @if (canBook) {
                    @if (row.appointmentDate <= today()) {
                      <button
                        matIconButton
                        type="button"
                        [attr.aria-label]="'No-show ' + row.number"
                        (click)="noShow(row)"
                      >
                        <mat-icon>person_off</mat-icon>
                      </button>
                    }
                    <button
                      matIconButton
                      type="button"
                      [attr.aria-label]="'Cancel ' + row.number"
                      (click)="cancel(row)"
                    >
                      <mat-icon>event_busy</mat-icon>
                    </button>
                  }
                }
                <button
                  matIconButton
                  type="button"
                  [attr.aria-label]="'Slip of ' + row.number"
                  (click)="slip(row)"
                >
                  <mat-icon>receipt</mat-icon>
                </button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
        @if (board.summary.byDepartment.length > 1) {
          <p class="mt-3 text-sm text-on-surface-variant">
            By department:
            @for (count of board.summary.byDepartment; track count.key; let last = $last) {
              {{ count.key }} {{ count.live }}{{ last ? '' : ' · ' }}
            }
          </p>
        }
      }
    }
  `,
})
export class AppointmentsPage {
  protected readonly store = inject(AppointmentBoardStore);
  private readonly api = inject(DiagnosticApi);
  private readonly dialog = inject(MatDialog);
  private readonly reports = inject(ReportDownloadService);
  private readonly notifications = inject(NotificationService);
  private readonly authorization = inject(Authorization);

  protected readonly canBill = this.authorization.can('diag:bill');
  protected readonly canBook = this.authorization.can('diag:book');
  protected readonly labels = APPOINTMENT_LABELS;
  protected readonly tones = APPOINTMENT_TONES;
  protected readonly columns = ['window', 'serial', 'patient', 'tests', 'amount', 'status', 'actions'];
  protected readonly day = () => fromDay(this.store.day());
  protected readonly today = () => toDay(new Date());
  protected readonly time = windowTime;

  private readonly departmentsResource = rxResource({ stream: () => this.api.departments() });
  protected readonly departments = computed(() =>
    (this.departmentsResource.hasValue() ? this.departmentsResource.value() : []).filter(
      (department) => department.kind !== 'other',
    ),
  );

  protected label(row: TestAppointment): string {
    return this.labels[row.status];
  }

  protected tone(row: TestAppointment) {
    return this.tones[row.status];
  }

  protected testNames(row: TestAppointment): string {
    return row.tests.map((test) => test.testName).join(', ');
  }

  protected pickDay(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) this.store.setDay(toDay(event.value));
  }

  protected book(): void {
    this.dialog
      .open<BookAppointmentDialog, BookAppointmentDialogData, { id: string; number: string; serial: number }>(
        BookAppointmentDialog,
        { ...WIDE, data: { day: this.store.day() } },
      )
      .afterClosed()
      .subscribe((booked) => {
        if (!booked) return;
        this.notifications.success(`Booked ${booked.number}, serial ${booked.serial}.`);
        this.store.reload();
        this.slip(booked);
      });
  }

  protected bill(row: TestAppointment): void {
    const booking: BillableBooking = {
      kind: 'appointment',
      id: row.id,
      number: row.number,
      patientId: row.patientId,
      patientName: row.patientName,
      mobileNo: row.mobileNo,
      tests: row.tests,
      charge: 0,
    };
    this.dialog
      .open<BillBookingDialog, BillableBooking, BillBookingResult>(BillBookingDialog, {
        ...WIDE,
        data: booking,
      })
      .afterClosed()
      .subscribe((bill) => {
        if (!bill) return;
        this.notifications.success(`Billed on ${bill.number}.`);
        this.store.reload();
        this.reports
          .download('hospital.diagnostic-receipt', { id: bill.id }, `receipt-${bill.number}`)
          .subscribe({ error: (error: unknown) => this.notifications.error(error) });
      });
  }

  protected noShow(row: TestAppointment): void {
    this.api.noShow(row.id, row.version).subscribe({
      next: () => {
        this.notifications.success(`${row.number} marked a no-show.`);
        this.store.reload();
      },
      error: (error: unknown) => this.notifications.error(error),
    });
  }

  protected cancel(row: TestAppointment): void {
    this.dialog
      .open<ReasonDialog, ReasonDialogData, true>(ReasonDialog, {
        ...WIDE,
        data: {
          title: `Cancel ${row.number}?`,
          message: `${row.patientName}'s place in ${row.windowLabel} is freed for another patient.`,
          confirmText: 'Cancel the booking',
          submit: (reason) => this.api.cancelAppointment(row.id, row.version, reason),
        },
      })
      .afterClosed()
      .subscribe((done) => {
        if (!done) return;
        this.notifications.success('Booking cancelled.');
        this.store.reload();
      });
  }

  protected slip(row: { id: string; number: string }): void {
    this.reports
      .download('hospital.test-appointment-slip', { id: row.id }, `slip-${row.number}`)
      .subscribe({ error: (error: unknown) => this.notifications.error(error) });
  }
}

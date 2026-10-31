import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize, Observable } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { addDays, atTime, fromDay, type OtCaseSummary, timeOf, toDay } from '../models/ot.models';
import { OtApi } from '../services/ot-api.service';

export interface ScheduleOtDialogData {
  readonly otCase: OtCaseSummary;
  readonly submit: (roomId: string, from: Date, to: Date) => Observable<void>;
}

/** A room and a time for an operation; scheduling again moves it. The backend refuses a clash (room_taken). */
@Component({
  selector: 'app-schedule-ot-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ValidationMessagePipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.otCase.otRoomId ? 'Move' : 'Schedule' }} {{ data.otCase.number }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="flex flex-col gap-1">
        <p class="mb-3 text-sm text-on-surface-variant">
          {{ data.otCase.patientName }} · {{ data.otCase.operationName }} · {{ data.otCase.surgeonName }}
        </p>
        @if (error()) {
          <p
            class="mb-3 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
            role="alert"
          >
            {{ error() }}
          </p>
        }
        <mat-form-field>
          <mat-label>OT room</mat-label>
          <mat-select formControlName="roomId" required data-testid="ot-room">
            @for (room of rooms(); track room.id) {
              <mat-option [value]="room.id"
                >{{ room.name }}{{ room.floor ? ' · ' + room.floor : '' }}</mat-option
              >
            }
          </mat-select>
          <mat-error>{{ form.controls.roomId.errors | validationMessage: 'Room' }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Day</mat-label>
          <input matInput [matDatepicker]="dayPicker" [min]="today" formControlName="day" required />
          <mat-datepicker-toggle matIconSuffix [for]="dayPicker" />
          <mat-datepicker #dayPicker />
          <mat-error>{{ form.controls.day.errors | validationMessage: 'Day' }}</mat-error>
        </mat-form-field>
        <div class="grid grid-cols-2 gap-x-3">
          <mat-form-field>
            <mat-label>From</mat-label>
            <input matInput type="time" formControlName="from" required />
          </mat-form-field>
          <mat-form-field>
            <mat-label>To</mat-label>
            <input matInput type="time" formControlName="to" required />
            @if (endsNextDay()) {
              <mat-hint>Ends the next day</mat-hint>
            }
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="ot-schedule-submit">
          {{ data.otCase.otRoomId ? 'Move' : 'Schedule' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ScheduleOtDialog {
  protected readonly data = inject<ScheduleOtDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(OtApi);
  private readonly dialogRef = inject<MatDialogRef<ScheduleOtDialog, true>>(MatDialogRef);

  protected readonly today = new Date(new Date().setHours(0, 0, 0, 0));
  private readonly booked = this.data.otCase.scheduledFrom;

  protected readonly form = inject(NonNullableFormBuilder).group({
    roomId: [this.data.otCase.otRoomId ?? '', Validators.required],
    day: new FormControl<Date | null>(
      this.booked ? fromDay(toDay(new Date(this.booked))) : this.firstDay(),
      Validators.required,
    ),
    from: [this.booked ? timeOf(this.booked) : '09:00', Validators.required],
    to: [this.data.otCase.scheduledTo ? timeOf(this.data.otCase.scheduledTo) : '10:00', Validators.required],
  });

  private readonly roomsResource = rxResource({ stream: () => this.api.rooms() });
  protected readonly rooms = computed(() =>
    this.roomsResource.hasValue() ? this.roomsResource.value() : [],
  );
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly endsNextDay = computed(() => {
    const { from, to } = this.value();
    return !!from && !!to && to <= from;
  });

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  /** The day asked for, or today when that has passed. */
  private firstDay(): Date {
    const asked = fromDay(this.data.otCase.requestedFor);
    return asked < this.today ? this.today : asked;
  }

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const day = toDay(value.day ?? this.today);
    const from = atTime(day, value.from);
    // An end at or before the start is on the next day (an operation past midnight).
    const to = atTime(value.to <= value.from ? addDays(day, 1) : day, value.to);

    this.submitting.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.data
      .submit(value.roomId, from, to)
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => this.error.set(describeError(toApiError(error))),
      });
  }
}

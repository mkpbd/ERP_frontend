import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { finalize, map, startWith } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import {
  addDays,
  BOOKING_DAYS_AHEAD,
  type ChosenTest,
  fromDay,
  toDay,
  windowTime,
} from '../models/diagnostic.models';
import { DiagnosticApi } from '../services/diagnostic-api.service';
import { bookingPatient, PatientFields, patientGroup } from './patient-fields';
import { TestBasket } from './test-basket';

export interface BookAppointmentDialogData {
  /** The day the board shows. */
  readonly day: string;
}

/** Old app's booking, at the desk: the patient, a day and window with a place left, the tests quoted. */
@Component({
  selector: 'app-book-appointment-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    PatientFields,
    TestBasket,
    ValidationMessagePipe,
  ],
  template: `
    <h2 mat-dialog-title>Book tests</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="flex flex-col gap-1">
        @if (error()) {
          <p
            class="mb-3 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
            role="alert"
          >
            {{ error() }}
          </p>
        }
        <app-patient-fields [group]="patient" />
        <div class="grid gap-x-3 sm:grid-cols-2">
          <mat-form-field>
            <mat-label>Day</mat-label>
            <input
              matInput
              [matDatepicker]="dayPicker"
              [min]="first"
              [max]="last"
              [formControl]="date"
              required
            />
            <mat-datepicker-toggle matIconSuffix [for]="dayPicker" />
            <mat-datepicker #dayPicker />
            <mat-error>{{ date.errors | validationMessage: 'Day' }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Department</mat-label>
            <mat-select [formControl]="departmentId" data-testid="booking-department">
              <mat-option [value]="null">Any department</mat-option>
              @for (department of bookableDepartments(); track department.id) {
                <mat-option [value]="department.id">{{ department.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <fieldset class="mb-3">
          <legend class="mb-2 text-sm font-medium">Window</legend>
          @if (windows.isLoading()) {
            <p class="text-sm text-on-surface-variant">Loading the windows…</p>
          } @else if (windowList().length === 0) {
            <p class="text-sm text-on-surface-variant">No window is offered for this department.</p>
          } @else {
            <mat-radio-group [formControl]="windowId" class="flex flex-col gap-1" aria-label="Window">
              @for (window of windowList(); track window.id) {
                <mat-radio-button [value]="window.id" [disabled]="window.over || window.left === 0">
                  <span class="font-medium">{{ window.label }}</span>
                  <span class="text-on-surface-variant">
                    · {{ time(window) }}{{ window.departmentName ? ' · ' + window.departmentName : '' }} ·
                    {{
                      window.over
                        ? 'over'
                        : window.left === 0
                          ? 'full'
                          : window.left + ' of ' + window.capacity + ' left'
                    }}
                  </span>
                </mat-radio-button>
              }
            </mat-radio-group>
          }
        </fieldset>

        <app-test-basket
          [(tests)]="tests"
          [departments]="departments()"
          [departmentId]="departmentIdValue()"
        />

        <mat-form-field class="w-full">
          <mat-label>Remarks</mat-label>
          <input matInput [formControl]="remarks" />
          <mat-error>{{ remarks.errors | validationMessage: 'Remarks' }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="booking-submit">
          Book
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class BookAppointmentDialog {
  private readonly data = inject<BookAppointmentDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(DiagnosticApi);
  private readonly dialogRef =
    inject<MatDialogRef<BookAppointmentDialog, { id: string; number: string; serial: number }>>(MatDialogRef);

  private readonly today = toDay(new Date());
  protected readonly first = fromDay(this.today);
  protected readonly last = fromDay(addDays(this.today, BOOKING_DAYS_AHEAD));
  protected readonly patient = patientGroup(true);
  protected readonly date = new FormControl<Date | null>(
    fromDay(this.data.day < this.today ? this.today : this.data.day),
    Validators.required,
  );
  protected readonly departmentId = new FormControl<string | null>(null);
  protected readonly windowId = new FormControl<string | null>(null, Validators.required);
  protected readonly remarks = new FormControl('', {
    nonNullable: true,
    validators: Validators.maxLength(300),
  });
  protected readonly tests = signal<readonly ChosenTest[]>([]);
  protected readonly form = new FormGroup({
    patient: this.patient,
    date: this.date,
    departmentId: this.departmentId,
    windowId: this.windowId,
    remarks: this.remarks,
  });

  private readonly day = toSignal(
    this.date.valueChanges.pipe(
      startWith(this.date.value),
      map((date) => (date ? toDay(date) : null)),
    ),
  );
  protected readonly departmentIdValue = toSignal(this.departmentId.valueChanges, { initialValue: null });

  private readonly departmentsResource = rxResource({ stream: () => this.api.departments() });
  protected readonly departments = computed(() =>
    this.departmentsResource.hasValue() ? this.departmentsResource.value() : [],
  );
  protected readonly bookableDepartments = computed(() =>
    this.departments().filter((department) => department.kind !== 'other'),
  );
  protected readonly windows = rxResource({
    params: () => ({ day: this.day(), departmentId: this.departmentIdValue() }),
    stream: ({ params }) => this.api.availability(params.day ?? this.today, params.departmentId),
  });
  protected readonly windowList = computed(() => (this.windows.hasValue() ? this.windows.value() : []));

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly time = windowTime;

  constructor() {
    // A window of another department, or one picked on another day, is chosen again.
    this.date.valueChanges.subscribe(() => this.windowId.setValue(null));
    this.departmentId.valueChanges.subscribe(() => this.windowId.setValue(null));
  }

  protected submit(): void {
    if (this.submitting()) return;
    if (this.patient.invalid || this.date.invalid || this.windowId.invalid || this.remarks.invalid) {
      this.patient.markAllAsTouched();
      this.date.markAsTouched();
      this.error.set('Give the patient, the day and a window with a place left.');
      return;
    }
    if (this.tests().length === 0) {
      this.error.set('Add the tests to book.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.api
      .bookAppointment({
        ...bookingPatient(this.patient),
        appointmentDate: toDay(this.date.value!),
        windowId: this.windowId.value!,
        testIds: this.tests().map((test) => test.id),
        remarks: this.remarks.value.trim() || null,
      })
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: (booked) => this.dialogRef.close(booked),
        error: (error: unknown) => {
          this.error.set(describeError(toApiError(error)));
          this.windows.reload();
        },
      });
  }
}

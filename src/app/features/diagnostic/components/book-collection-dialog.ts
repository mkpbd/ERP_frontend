import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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
  servedDays,
  servesOn,
  sumRates,
  toDay,
} from '../models/diagnostic.models';
import { DiagnosticApi } from '../services/diagnostic-api.service';
import { bookingPatient, PatientFields, patientGroup } from './patient-fields';
import { TestBasket } from './test-basket';

export interface BookCollectionDialogData {
  readonly day: string;
}

/** A collector asked to an address: the area sets the charge, the smallest order and the days served. */
@Component({
  selector: 'app-book-collection-dialog',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PatientFields,
    TestBasket,
    ValidationMessagePipe,
  ],
  template: `
    <h2 mat-dialog-title>Book a home collection</h2>
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
        <div class="grid gap-x-3 sm:grid-cols-3">
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
            <mat-label>Area</mat-label>
            <mat-select [formControl]="areaId" required data-testid="collection-area">
              @for (area of areaList(); track area.id) {
                <mat-option [value]="area.id">{{ area.name }}</mat-option>
              }
            </mat-select>
            @if (area(); as chosen) {
              <mat-hint
                >{{ chosen.charge | currency: 'BDT' : '৳ ' }} a visit · {{ days(chosen.days) }}</mat-hint
              >
            }
            <mat-error>{{ areaId.errors | validationMessage: 'Area' }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Window</mat-label>
            <mat-select [formControl]="windowId" required data-testid="collection-window">
              @for (window of windowList(); track window.id) {
                <mat-option [value]="window.id">{{ window.label }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ windowId.errors | validationMessage: 'Window' }}</mat-error>
          </mat-form-field>
        </div>
        <mat-form-field class="w-full">
          <mat-label>Address</mat-label>
          <textarea
            matInput
            [formControl]="address"
            rows="2"
            required
            data-testid="collection-address"
          ></textarea>
          <mat-error>{{ address.errors | validationMessage: 'Address' }}</mat-error>
        </mat-form-field>
        <mat-form-field class="w-full">
          <mat-label>Landmark</mat-label>
          <input matInput [formControl]="landmark" />
          <mat-error>{{ landmark.errors | validationMessage: 'Landmark' }}</mat-error>
        </mat-form-field>

        <app-test-basket [(tests)]="tests" [departments]="departments()" [labOnly]="true" />

        @if (area(); as chosen) {
          <dl class="mb-2 grid grid-cols-[1fr_auto] gap-x-4 text-sm" aria-label="What the visit costs">
            <dt>Visit charge</dt>
            <dd class="text-right tabular-nums">{{ chosen.charge | currency: 'BDT' : '৳ ' }}</dd>
            <dt class="font-medium">Total</dt>
            <dd class="text-right font-medium tabular-nums">{{ total() | currency: 'BDT' : '৳ ' }}</dd>
          </dl>
          @if (shortfall() > 0) {
            <p class="mb-2 text-sm text-error" role="status">
              {{ chosen.name }} takes orders from {{ chosen.minimumOrder | currency: 'BDT' : '৳ ' }}:
              {{ shortfall() | currency: 'BDT' : '৳ ' }} short.
            </p>
          }
          @if (closedThatDay()) {
            <p class="mb-2 text-sm text-error" role="status">
              {{ chosen.name }} is served on {{ days(chosen.days) }} only.
            </p>
          }
        }

        <mat-form-field class="w-full">
          <mat-label>Note for the collector</mat-label>
          <input matInput [formControl]="note" />
          <mat-error>{{ note.errors | validationMessage: 'Note' }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="collection-submit">
          Book
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class BookCollectionDialog {
  private readonly data = inject<BookCollectionDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(DiagnosticApi);
  private readonly dialogRef =
    inject<MatDialogRef<BookCollectionDialog, { id: string; number: string }>>(MatDialogRef);

  private readonly today = toDay(new Date());
  protected readonly first = fromDay(this.today);
  protected readonly last = fromDay(addDays(this.today, BOOKING_DAYS_AHEAD));
  protected readonly patient = patientGroup(true);
  protected readonly date = new FormControl<Date | null>(
    fromDay(this.data.day < this.today ? this.today : this.data.day),
    Validators.required,
  );
  protected readonly areaId = new FormControl<string | null>(null, Validators.required);
  protected readonly windowId = new FormControl<string | null>(null, Validators.required);
  protected readonly address = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)],
  });
  protected readonly landmark = new FormControl('', {
    nonNullable: true,
    validators: Validators.maxLength(150),
  });
  protected readonly note = new FormControl('', { nonNullable: true, validators: Validators.maxLength(300) });
  protected readonly tests = signal<readonly ChosenTest[]>([]);
  protected readonly form = new FormGroup({
    patient: this.patient,
    date: this.date,
    areaId: this.areaId,
    windowId: this.windowId,
    address: this.address,
    landmark: this.landmark,
    note: this.note,
  });

  private readonly departmentsResource = rxResource({ stream: () => this.api.departments() });
  protected readonly departments = computed(() =>
    this.departmentsResource.hasValue() ? this.departmentsResource.value() : [],
  );
  private readonly areas = rxResource({ stream: () => this.api.areas() });
  protected readonly areaList = computed(() => (this.areas.hasValue() ? this.areas.value() : []));
  private readonly windows = rxResource({ stream: () => this.api.collectionWindows() });
  protected readonly windowList = computed(() => (this.windows.hasValue() ? this.windows.value() : []));

  private readonly areaIdValue = toSignal(this.areaId.valueChanges, { initialValue: null });
  private readonly day = toSignal(
    this.date.valueChanges.pipe(
      startWith(this.date.value),
      map((date) => (date ? toDay(date) : null)),
    ),
  );
  protected readonly area = computed(
    () => this.areaList().find((area) => area.id === this.areaIdValue()) ?? null,
  );
  private readonly testsTotal = computed(() => sumRates(this.tests().map((test) => test.rate)));
  protected readonly total = computed(() => sumRates([this.testsTotal(), this.area()?.charge ?? 0]));
  protected readonly shortfall = computed(() => {
    const area = this.area();
    return area && this.tests().length ? Math.max(0, sumRates([area.minimumOrder, -this.testsTotal()])) : 0;
  });
  protected readonly closedThatDay = computed(() => {
    const area = this.area();
    const day = this.day();
    return !!area && !!day && !servesOn(area, day);
  });

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly days = servedDays;

  protected submit(): void {
    if (this.submitting()) return;
    const controls = [this.date, this.areaId, this.windowId, this.address, this.landmark, this.note];
    if (this.patient.invalid || controls.some((control) => control.invalid)) {
      this.patient.markAllAsTouched();
      controls.forEach((control) => control.markAsTouched());
      this.error.set('Give the patient, the day, the area, the window and the address.');
      return;
    }
    if (this.tests().length === 0) {
      this.error.set('Add the tests to collect.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.api
      .bookCollection({
        ...bookingPatient(this.patient),
        collectionDate: toDay(this.date.value!),
        windowId: this.windowId.value!,
        areaId: this.areaId.value!,
        address: this.address.value.trim(),
        landmark: this.landmark.value.trim() || null,
        testIds: this.tests().map((test) => test.id),
        note: this.note.value.trim() || null,
      })
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: (booked) => this.dialogRef.close(booked),
        error: (error: unknown) => this.error.set(describeError(toApiError(error))),
      });
  }
}

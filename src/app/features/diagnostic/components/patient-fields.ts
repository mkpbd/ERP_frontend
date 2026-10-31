import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { OptionPicker, type PickerOption } from '../../../shared/components/option-picker';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import type { BookingPatient, PatientOption } from '../models/diagnostic.models';
import { DiagnosticApi } from '../services/diagnostic-api.service';

const MOBILE = /^(\+?880|0)?1[3-9]\d{8}$/;

export type PatientGroup = FormGroup<{
  registered: FormControl<boolean>;
  patientId: FormControl<string | null>;
  patientName: FormControl<string>;
  mobileNo: FormControl<string>;
}>;

/** The patient of a booking: registered (searched), or a name and mobile number until they register. */
export function patientGroup(registered: boolean): PatientGroup {
  const group: PatientGroup = new FormGroup({
    registered: new FormControl(registered, { nonNullable: true }),
    patientId: new FormControl<string | null>(null),
    patientName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
    mobileNo: new FormControl('', { nonNullable: true }),
  });
  const apply = (isRegistered: boolean) => {
    group.controls.patientId.setValidators(isRegistered ? Validators.required : null);
    group.controls.patientName.setValidators(
      isRegistered ? Validators.maxLength(150) : [Validators.required, Validators.maxLength(150)],
    );
    group.controls.mobileNo.setValidators(
      isRegistered ? null : [Validators.required, Validators.pattern(MOBILE)],
    );
    for (const control of [group.controls.patientId, group.controls.patientName, group.controls.mobileNo]) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  };
  apply(registered);
  group.controls.registered.valueChanges.subscribe(apply);
  return group;
}

export function bookingPatient(group: PatientGroup): BookingPatient {
  const value = group.getRawValue();
  return value.registered
    ? { patientId: value.patientId, patientName: null, mobileNo: null }
    : {
        patientId: null,
        patientName: value.patientName.trim(),
        mobileNo: value.mobileNo.replace(/[\s-]/g, ''),
      };
}

@Component({
  selector: 'app-patient-fields',
  imports: [
    ReactiveFormsModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    OptionPicker,
    ValidationMessagePipe,
  ],
  template: `
    <fieldset class="mb-2" [formGroup]="group()">
      <legend class="mb-2 text-sm font-medium">Patient</legend>
      @if (canSearch && !registeredOnly()) {
        <mat-button-toggle-group
          formControlName="registered"
          class="mb-3"
          aria-label="Registered or not"
          hideSingleSelectionIndicator
        >
          <mat-button-toggle [value]="true">Registered</mat-button-toggle>
          <mat-button-toggle [value]="false">Not registered yet</mat-button-toggle>
        </mat-button-toggle-group>
      }
      @if (group().controls.registered.value) {
        <app-option-picker
          label="Patient"
          placeholder="Name, UHID or mobile"
          [options]="patientOptions()"
          [required]="true"
          (lookup)="search.next($event)"
          formControlName="patientId"
          testId="booking-patient"
        />
      } @else {
        <div class="grid gap-x-3 sm:grid-cols-2">
          <mat-form-field>
            <mat-label>Name</mat-label>
            <input matInput formControlName="patientName" required data-testid="booking-name" />
            <mat-error>{{ group().controls.patientName.errors | validationMessage: 'Name' }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Mobile</mat-label>
            <input
              matInput
              formControlName="mobileNo"
              required
              inputmode="tel"
              data-testid="booking-mobile"
            />
            <mat-hint>01XXXXXXXXX</mat-hint>
            <mat-error>{{ group().controls.mobileNo.errors | validationMessage: 'Mobile' }}</mat-error>
          </mat-form-field>
        </div>
      }
    </fieldset>
  `,
})
export class PatientFields {
  readonly group = input.required<PatientGroup>();
  /** Billing: a registered patient only. */
  readonly registeredOnly = input(false);

  private readonly api = inject(DiagnosticApi);
  /** Searching patients needs patient:read; without it the desk books by name and mobile. */
  protected readonly canSearch = inject(Authorization).can('patient:read');

  protected readonly search = new Subject<string>();
  private readonly patients = signal<readonly PatientOption[]>([]);
  protected readonly patientOptions = computed<PickerOption[]>(() =>
    this.patients().map((patient) => ({
      id: patient.id,
      label: `${patient.fullName} · UHID ${patient.uhid}`,
      hint: patient.mobileNo,
    })),
  );

  constructor() {
    this.search
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => this.api.patients(q)),
        takeUntilDestroyed(),
      )
      .subscribe({ next: (patients) => this.patients.set(patients), error: () => this.patients.set([]) });
  }
}

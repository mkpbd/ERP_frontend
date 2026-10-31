import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { OptionPicker, type PickerOption } from '../../../shared/components/option-picker';
import {
  ADMISSION_KINDS,
  type AdmissionKind,
  KIND_LABELS,
  PAYMENT_METHODS,
  type PatientOption,
  type PaymentMethod,
} from '../models/ipd.models';
import { IpdApi } from '../services/ipd-api.service';
import { submitDialog } from './dialog-submit';

/** Old patient admission: a registered patient into a free bed, under a consultant, with who pays and an advance. */
@Component({
  selector: 'app-admit-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    OptionPicker,
  ],
  template: `
    <h2 mat-dialog-title>Admit a patient</h2>
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
        <app-option-picker
          label="Patient"
          placeholder="Name, UHID or mobile"
          [options]="patientOptions()"
          [required]="true"
          (lookup)="patientSearch.next($event)"
          formControlName="patientId"
          testId="admit-patient"
        />
        <div class="grid gap-x-3 sm:grid-cols-2">
          <mat-form-field>
            <mat-label>Bed</mat-label>
            <mat-select formControlName="bedId" required data-testid="admit-bed">
              @for (bed of freeBeds(); track bed.id) {
                <mat-option [value]="bed.id">{{ bed.label }}</mat-option>
              } @empty {
                <mat-option disabled>No free bed</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Kind</mat-label>
            <mat-select formControlName="kind">
              @for (kind of kinds; track kind) {
                <mat-option [value]="kind">{{ kindLabels[kind] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <app-option-picker
          label="Consultant"
          [options]="consultantOptions()"
          [required]="true"
          formControlName="doctorId"
          testId="admit-consultant"
        />
        <app-option-picker label="Referred by" [options]="doctorOptions()" formControlName="referredById" />
        <mat-form-field>
          <mat-label>Who pays</mat-label>
          <mat-select formControlName="payer">
            <mat-option value="own">The patient's own client, if any</mat-option>
            <mat-option value="patient">The patient</mat-option>
            @for (client of clients(); track client.id) {
              <mat-option [value]="client.id">{{ client.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Reason for admission</mat-label>
          <textarea matInput formControlName="reason" rows="2"></textarea>
        </mat-form-field>
        <div class="grid gap-x-3 sm:grid-cols-2">
          <mat-form-field>
            <mat-label>Advance (optional)</mat-label>
            <input matInput type="number" min="0" formControlName="advance" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Paid by</mat-label>
            <mat-select formControlName="method">
              @for (method of methods; track method) {
                <mat-option [value]="method">{{ method }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="admit-submit">
          Admit
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class AdmitDialog {
  private readonly api = inject(IpdApi);
  private readonly dialogRef =
    inject<MatDialogRef<AdmitDialog, { id: string; number: string }>>(MatDialogRef);

  protected readonly kinds = ADMISSION_KINDS;
  protected readonly kindLabels = KIND_LABELS;
  protected readonly methods = PAYMENT_METHODS;
  protected readonly form = new FormGroup({
    patientId: new FormControl<string | null>(null, Validators.required),
    bedId: new FormControl<string | null>(null, Validators.required),
    kind: new FormControl<AdmissionKind>('elective', { nonNullable: true }),
    doctorId: new FormControl<string | null>(null, Validators.required),
    referredById: new FormControl<string | null>(null),
    payer: new FormControl('own', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    advance: new FormControl<number | null>(null, [Validators.min(0)]),
    method: new FormControl<PaymentMethod>('cash', { nonNullable: true }),
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly patientSearch = new Subject<string>();
  private readonly patients = signal<readonly PatientOption[]>([]);
  protected readonly patientOptions = computed<PickerOption[]>(() =>
    this.patients().map((patient) => ({
      id: patient.id,
      label: `${patient.fullName} · UHID ${patient.uhid}`,
      hint: [patient.sex, patient.mobileNo].filter(Boolean).join(' · '),
    })),
  );

  private readonly board = rxResource({ stream: () => this.api.bedBoard() });
  protected readonly freeBeds = computed(() =>
    (this.board.hasValue() ? this.board.value().wards : []).flatMap((ward) =>
      ward.beds
        .filter((bed) => bed.status === 'available')
        .map((bed) => ({
          id: bed.id,
          label: `${ward.name} · ${bed.code} (${bed.categoryName}, ${bed.dailyRate}/night)`,
        })),
    ),
  );
  private readonly consultants = rxResource({ stream: () => this.api.doctors(true) });
  private readonly doctors = rxResource({ stream: () => this.api.doctors() });
  private readonly clientList = rxResource({ stream: () => this.api.corporateClients() });
  protected readonly consultantOptions = computed<PickerOption[]>(() =>
    (this.consultants.hasValue() ? this.consultants.value() : []).map((doctor) => ({
      id: doctor.id,
      label: doctor.name,
      hint: doctor.degrees,
    })),
  );
  protected readonly doctorOptions = computed<PickerOption[]>(() =>
    (this.doctors.hasValue() ? this.doctors.value() : []).map((doctor) => ({
      id: doctor.id,
      label: doctor.name,
    })),
  );
  protected readonly clients = computed(() => (this.clientList.hasValue() ? this.clientList.value() : []));

  constructor() {
    this.patientSearch
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => this.api.patients(q)),
        takeUntilDestroyed(),
      )
      .subscribe((patients) => this.patients.set(patients));
    this.patientSearch.next('');
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Choose the patient, a free bed and the consultant.');
      return;
    }
    const value = this.form.getRawValue();
    const advance = value.advance && value.advance > 0 ? value.advance : null;
    submitDialog(
      this.dialogRef,
      { submitting: this.submitting, error: this.error },
      this.api.admit({
        patientId: value.patientId ?? '',
        bedId: value.bedId ?? '',
        doctorId: value.doctorId ?? '',
        kind: value.kind,
        reason: value.reason.trim() || null,
        referredById: value.referredById,
        ...(value.payer === 'own'
          ? {}
          : { corporateClientId: value.payer === 'patient' ? null : value.payer }),
        advance: advance ? { amount: advance, method: value.method, reference: null } : null,
      }),
    );
  }
}

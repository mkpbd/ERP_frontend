import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Observable } from 'rxjs';
import { OptionPicker, type PickerOption } from '../../../shared/components/option-picker';
import {
  ADMISSION_KINDS,
  type Admission,
  type AdmissionKind,
  type CorrectionRequest,
  KIND_LABELS,
} from '../models/ipd.models';
import { IpdApi } from '../services/ipd-api.service';
import { submitDialog } from '../../../shared/utils/dialog-submit';

export interface CorrectDialogData {
  readonly admission: Admission;
  /** Who pays can change only before the final bill. */
  readonly billed: boolean;
  readonly submit: (correction: CorrectionRequest) => Observable<void>;
}

const STAFF = 'staff';

/** The admission put right while the patient is in: kind, reason, referring doctor and who pays. */
@Component({
  selector: 'app-correct-dialog',
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
    <h2 mat-dialog-title>Correct the admission</h2>
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
        <mat-form-field>
          <mat-label>Kind</mat-label>
          <mat-select formControlName="kind">
            @for (kind of kinds; track kind) {
              <mat-option [value]="kind">{{ kindLabels[kind] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Reason for admission</mat-label>
          <textarea matInput formControlName="reason" rows="2"></textarea>
        </mat-form-field>
        <app-option-picker label="Referred by" [options]="doctorOptions()" formControlName="referredById" />
        <mat-form-field>
          <mat-label>Who pays</mat-label>
          <mat-select formControlName="payer" data-testid="correct-payer">
            <mat-option value="patient">The patient</mat-option>
            @if (data.admission.staffId) {
              <mat-option value="staff">As staff (kept)</mat-option>
            }
            @for (client of clients(); track client.id) {
              <mat-option [value]="client.id">{{ client.name }}</mat-option>
            }
          </mat-select>
          @if (data.billed) {
            <mat-hint>The final bill is made: cancel it to change who pays.</mat-hint>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="correct-submit">
          Save
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CorrectDialog {
  protected readonly data = inject<CorrectDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(IpdApi);
  private readonly dialogRef = inject<MatDialogRef<CorrectDialog, true>>(MatDialogRef);

  protected readonly kinds = ADMISSION_KINDS;
  protected readonly kindLabels = KIND_LABELS;
  private readonly admission = this.data.admission;
  protected readonly form = new FormGroup({
    kind: new FormControl<AdmissionKind>(this.admission.kind, { nonNullable: true }),
    reason: new FormControl(this.admission.reason ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    referredById: new FormControl<string | null>(this.admission.referredById),
    payer: new FormControl(
      {
        value: this.admission.corporateClientId ?? (this.admission.staffId ? STAFF : 'patient'),
        disabled: this.data.billed,
      },
      { nonNullable: true },
    ),
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly doctors = rxResource({ stream: () => this.api.doctors() });
  private readonly clientList = rxResource({ stream: () => this.api.corporateClients() });
  protected readonly doctorOptions = computed<PickerOption[]>(() =>
    (this.doctors.hasValue() ? this.doctors.value() : []).map((doctor) => ({
      id: doctor.id,
      label: doctor.name,
    })),
  );
  protected readonly clients = computed(() => (this.clientList.hasValue() ? this.clientList.value() : []));

  protected submit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const corporate = value.payer !== 'patient' && value.payer !== STAFF;
    submitDialog(
      this.dialogRef,
      { submitting: this.submitting, error: this.error },
      this.data.submit({
        kind: value.kind,
        reason: value.reason.trim() || null,
        referredById: value.referredById,
        corporateClientId: corporate ? value.payer : null,
        staffId: value.payer === STAFF ? this.admission.staffId : null,
      }),
    );
  }
}

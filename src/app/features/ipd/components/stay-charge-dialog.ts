import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { Observable } from 'rxjs';
import { OptionPicker, type PickerOption } from '../../../shared/components/option-picker';
import { IpdApi } from '../services/ipd-api.service';
import { submitDialog } from './dialog-submit';

export interface StayChargeDialogData {
  readonly submit: (request: {
    serviceId: string;
    doctorId: string | null;
    qty: number;
    note: string | null;
  }) => Observable<unknown>;
}

/** A service given on the stay (a dressing, a consultant's visit …), with the doctor who gave it when it carries a share. */
@Component({
  selector: 'app-stay-charge-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    OptionPicker,
  ],
  template: `
    <h2 mat-dialog-title>Charge a service</h2>
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
          label="Service"
          [options]="serviceOptions()"
          [required]="true"
          formControlName="serviceId"
          testId="stay-service"
        />
        <app-option-picker
          label="Doctor"
          [options]="doctorOptions()"
          formControlName="doctorId"
          [hint]="doctorHint()"
        />
        <div class="grid grid-cols-[8rem_1fr] gap-x-3">
          <mat-form-field>
            <mat-label>Quantity</mat-label>
            <input matInput type="number" min="1" max="1000" formControlName="qty" required />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Note</mat-label>
            <input matInput formControlName="note" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="stay-charge-submit">
          Charge
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class StayChargeDialog {
  protected readonly data = inject<StayChargeDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(IpdApi);
  private readonly dialogRef = inject<MatDialogRef<StayChargeDialog, unknown>>(MatDialogRef);

  protected readonly form = new FormGroup({
    serviceId: new FormControl<string | null>(null, Validators.required),
    doctorId: new FormControl<string | null>(null),
    qty: new FormControl(1, { nonNullable: true, validators: [Validators.min(1), Validators.max(1000)] }),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly services = rxResource({ stream: () => this.api.services() });
  private readonly doctors = rxResource({ stream: () => this.api.doctors() });
  protected readonly serviceOptions = computed<PickerOption[]>(() =>
    (this.services.hasValue() ? this.services.value() : []).map((service) => ({
      id: service.id,
      label: service.name,
      hint: `${service.rate}${service.sharePercent !== null ? ` · doctor's share ${service.sharePercent}%` : ''}`,
    })),
  );
  protected readonly doctorOptions = computed<PickerOption[]>(() =>
    (this.doctors.hasValue() ? this.doctors.value() : []).map((doctor) => ({
      id: doctor.id,
      label: doctor.name,
    })),
  );
  private readonly needsDoctor = computed(() => {
    const id = this.value().serviceId;
    const service = (this.services.hasValue() ? this.services.value() : []).find((row) => row.id === id);
    return (service?.sharePercent ?? null) !== null;
  });
  protected readonly doctorHint = computed(() =>
    this.needsDoctor() ? "This service carries a doctor's share: name the doctor." : undefined,
  );

  protected submit(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.serviceId) {
      this.error.set('Choose the service.');
      return;
    }
    if (this.needsDoctor() && !value.doctorId) {
      this.error.set("This service carries a doctor's share: name the doctor.");
      return;
    }
    submitDialog(
      this.dialogRef,
      { submitting: this.submitting, error: this.error },
      this.data.submit({
        serviceId: value.serviceId,
        doctorId: value.doctorId,
        qty: value.qty,
        note: value.note.trim() || null,
      }),
    );
  }
}

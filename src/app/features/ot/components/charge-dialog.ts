import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize, Observable } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import { OptionPicker, type PickerOption } from '../../../shared/components/option-picker';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import type { ChargeRequest, OtCase } from '../models/ot.models';
import { OtApi } from '../services/ot-api.service';

export interface ChargeDialogData {
  readonly otCase: OtCase;
  readonly submit: (request: Omit<ChargeRequest, 'otCaseId'>) => Observable<void>;
}

/**
 * A charge for the operation: a service of the stay with the doctor who gave it. A service that carries a
 * doctor's share needs the doctor; the share then goes to them through the final bill. The team is listed
 * first.
 */
@Component({
  selector: 'app-charge-dialog',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    OptionPicker,
    ValidationMessagePipe,
  ],
  template: `
    <h2 mat-dialog-title>Charge for {{ data.otCase.number }}</h2>
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
          testId="ot-charge-service"
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
            <mat-error>{{ form.controls.qty.errors | validationMessage: 'Quantity' }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Note</mat-label>
            <input matInput formControlName="note" />
          </mat-form-field>
        </div>
        @if (service(); as service) {
          <p class="text-sm text-on-surface-variant">
            {{ service.rate | currency: 'BDT' : 'symbol-narrow' }} each ·
            {{ service.rate * (value().qty ?? 1) | currency: 'BDT' : 'symbol-narrow' }}
            @if (service.sharePercent !== null) {
              · doctor's share {{ service.sharePercent }}%
            }
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="ot-charge-submit">
          Charge
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ChargeDialog {
  protected readonly data = inject<ChargeDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(OtApi);
  private readonly dialogRef = inject<MatDialogRef<ChargeDialog, true>>(MatDialogRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    serviceId: new FormControl<string | null>(null, Validators.required),
    doctorId: new FormControl<string | null>(null),
    qty: [1, [Validators.required, Validators.min(1), Validators.max(1000)]],
    note: ['', Validators.maxLength(200)],
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  private readonly services = rxResource({ stream: () => this.api.services() });
  private readonly doctors = rxResource({ stream: () => this.api.doctors() });

  protected readonly serviceOptions = computed<PickerOption[]>(() =>
    (this.services.hasValue() ? this.services.value() : []).map((service) => ({
      id: service.id,
      label: service.name,
      hint: service.code,
    })),
  );
  protected readonly doctorOptions = computed<PickerOption[]>(() => {
    const { surgeonId, anaesthetistId, team } = this.data.otCase;
    const teamIds = [surgeonId, anaesthetistId, ...team.map((member) => member.doctorId)];
    const all = this.doctors.hasValue() ? this.doctors.value() : [];
    const rank = (id: string) => {
      const index = teamIds.indexOf(id);
      return index < 0 ? teamIds.length : index;
    };
    return [...all]
      .sort((a, b) => rank(a.id) - rank(b.id))
      .map((doctor) => ({
        id: doctor.id,
        label: doctor.name,
        hint: teamIds.includes(doctor.id) ? 'In the team' : doctor.degrees,
      }));
  });
  protected readonly service = computed(() => {
    const id = this.value().serviceId;
    return (
      (this.services.hasValue() ? this.services.value() : []).find((service) => service.id === id) ?? null
    );
  });
  protected readonly needsDoctor = computed(() => (this.service()?.sharePercent ?? null) !== null);
  protected readonly doctorHint = computed(() =>
    this.needsDoctor() ? "This service carries a doctor's share: name the doctor." : undefined,
  );

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.form.controls.serviceId.invalid ? 'Choose the service.' : null);
      return;
    }
    const value = this.form.getRawValue();
    if (this.needsDoctor() && !value.doctorId) {
      this.error.set("This service carries a doctor's share: name the doctor.");
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.data
      .submit({
        serviceId: value.serviceId ?? '',
        doctorId: value.doctorId,
        qty: value.qty,
        note: value.note.trim() || null,
      })
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

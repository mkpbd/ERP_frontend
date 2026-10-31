import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import {
  type BillableBooking,
  METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
  sumRates,
} from '../models/diagnostic.models';
import { DiagnosticApi } from '../services/diagnostic-api.service';
import { PatientFields, patientGroup } from './patient-fields';

export interface BillBookingResult {
  readonly id: string;
  readonly number: string;
  readonly due: number;
}

/**
 * The booking billed at the counter: its tests (and a home visit's charge, added by the hospital as its service),
 * to a registered patient, with what is paid now. Discounts, payers and other tests are the full bill's.
 */
@Component({
  selector: 'app-bill-booking-dialog',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PatientFields,
    ValidationMessagePipe,
  ],
  template: `
    <h2 mat-dialog-title>Bill {{ data.number }}</h2>
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
        @if (data.patientId) {
          <p class="mb-3">
            <span class="font-medium">{{ data.patientName }}</span>
            <span class="text-on-surface-variant"> · {{ data.mobileNo }}</span>
          </p>
        } @else {
          <p class="mb-2 text-sm text-on-surface-variant">
            Booked for {{ data.patientName }} ({{ data.mobileNo }}), not registered: bill the registered
            patient.
          </p>
          <app-patient-fields [group]="patient" [registeredOnly]="true" />
        }
        <table class="mb-3 w-full text-sm" aria-label="What is billed">
          <tbody>
            @for (test of data.tests; track test.testId) {
              <tr>
                <td class="py-1">{{ test.testName }}</td>
                <td class="py-1 text-right tabular-nums">{{ test.rate | currency: 'BDT' : '৳ ' }}</td>
              </tr>
            }
            @if (data.charge > 0) {
              <tr>
                <td class="py-1">Home collection charge</td>
                <td class="py-1 text-right tabular-nums">{{ data.charge | currency: 'BDT' : '৳ ' }}</td>
              </tr>
            }
            <tr class="border-t border-outline-variant font-medium">
              <td class="py-1">Total</td>
              <td class="py-1 text-right tabular-nums" data-testid="bill-total">
                {{ total | currency: 'BDT' : '৳ ' }}
              </td>
            </tr>
          </tbody>
        </table>
        <div class="grid gap-x-3 sm:grid-cols-3">
          <mat-form-field>
            <mat-label>Paid now</mat-label>
            <input
              matInput
              type="number"
              [formControl]="amount"
              min="0"
              step="0.01"
              data-testid="bill-paid"
            />
            <mat-error>{{ amount.errors | validationMessage: 'Paid now' }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Paid by</mat-label>
            <mat-select [formControl]="method">
              @for (option of methods; track option) {
                <mat-option [value]="option">{{ methodLabels[option] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Reference</mat-label>
            <input matInput [formControl]="reference" />
          </mat-form-field>
        </div>
        <p class="text-sm text-on-surface-variant">Due after this: {{ due() | currency: 'BDT' : '৳ ' }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="bill-submit">
          Bill
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class BillBookingDialog {
  protected readonly data = inject<BillableBooking>(MAT_DIALOG_DATA);
  private readonly api = inject(DiagnosticApi);
  private readonly dialogRef = inject<MatDialogRef<BillBookingDialog, BillBookingResult>>(MatDialogRef);

  protected readonly methods = PAYMENT_METHODS;
  protected readonly methodLabels = METHOD_LABELS;
  protected readonly total = sumRates([...this.data.tests.map((test) => test.rate), this.data.charge]);
  protected readonly patient = patientGroup(true);
  protected readonly amount = new FormControl<number | null>(this.total, [
    Validators.min(0),
    Validators.max(this.total),
  ]);
  protected readonly method = new FormControl<PaymentMethod>('cash', { nonNullable: true });
  protected readonly reference = new FormControl('', {
    nonNullable: true,
    validators: Validators.maxLength(100),
  });
  protected readonly form = new FormGroup({
    patient: this.patient,
    amount: this.amount,
    method: this.method,
    reference: this.reference,
  });
  private readonly paid = signal(this.total);
  protected readonly due = computed(() => sumRates([this.total, -this.paid()]));

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.amount.valueChanges.subscribe((value) => this.paid.set(value ?? 0));
  }

  protected submit(): void {
    if (this.submitting()) return;
    const patientId = this.data.patientId ?? this.patient.controls.patientId.value;
    if (!patientId || this.amount.invalid || this.reference.invalid) {
      this.patient.markAllAsTouched();
      this.amount.markAsTouched();
      this.error.set(
        patientId ? 'Paid now is between nothing and the total.' : 'Choose the registered patient.',
      );
      return;
    }
    const amount = this.amount.value ?? 0;
    this.submitting.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    this.api
      .bill({
        patientId,
        testIds: this.data.tests.map((test) => test.testId),
        ...(this.data.kind === 'appointment'
          ? { testAppointmentId: this.data.id }
          : { homeCollectionId: this.data.id }),
        payment:
          amount > 0
            ? { amount, method: this.method.value, reference: this.reference.value.trim() || null }
            : null,
      })
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: (bill) => this.dialogRef.close({ id: bill.id, number: bill.number, due: bill.due }),
        error: (error: unknown) => this.error.set(describeError(toApiError(error))),
      });
  }
}

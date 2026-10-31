import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Observable } from 'rxjs';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { type MoneyInput, PAYMENT_METHODS, type PaymentMethod } from '../models/ipd.models';
import { submitDialog } from '../../../shared/utils/dialog-submit';

export interface MoneyDialogData {
  readonly title: string;
  readonly confirmText: string;
  /** The most that may be taken or given back (the due, the advance held); none: no limit. */
  readonly max: number | null;
  readonly submit: (money: MoneyInput) => Observable<unknown>;
}

/** Money in or out on a stay: an advance, a refund of advance held, a due collected against the final bill. */
@Component({
  selector: 'app-money-dialog',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ValidationMessagePipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
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
          <mat-label>Amount</mat-label>
          <input
            matInput
            type="number"
            min="0.01"
            formControlName="amount"
            required
            data-testid="money-amount"
          />
          @if (data.max !== null) {
            <mat-hint>Up to {{ data.max | currency: 'BDT' : 'symbol-narrow' }}</mat-hint>
          }
          <mat-error>{{ form.controls.amount.errors | validationMessage: 'Amount' }}</mat-error>
        </mat-form-field>
        <div class="grid gap-x-3 sm:grid-cols-2">
          <mat-form-field>
            <mat-label>Method</mat-label>
            <mat-select formControlName="method">
              @for (method of methods; track method) {
                <mat-option [value]="method">{{ method }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Reference</mat-label>
            <input matInput formControlName="reference" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="money-submit">
          {{ data.confirmText }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class MoneyDialog {
  protected readonly data = inject<MoneyDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<MoneyDialog, unknown>>(MatDialogRef);

  protected readonly methods = PAYMENT_METHODS;
  protected readonly form = new FormGroup({
    amount: new FormControl<number | null>(this.data.max, [
      Validators.required,
      Validators.min(0.01),
      ...(this.data.max !== null ? [Validators.max(this.data.max)] : []),
    ]),
    method: new FormControl<PaymentMethod>('cash', { nonNullable: true }),
    reference: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { amount, method, reference } = this.form.getRawValue();
    submitDialog(
      this.dialogRef,
      { submitting: this.submitting, error: this.error },
      this.data.submit({
        amount: Math.round((amount ?? 0) * 100) / 100,
        method,
        reference: reference.trim() || null,
      }),
    );
  }
}

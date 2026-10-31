import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Observable } from 'rxjs';
import { type MoneyInput, PAYMENT_METHODS, type PaymentMethod } from '../models/ipd.models';
import { submitDialog } from './dialog-submit';

export interface FinalBillDialogData {
  /** What the bill would be today, before any discount, and the advance held against it. */
  readonly total: number;
  readonly held: number;
  readonly submit: (request: {
    discount: number | null;
    discountReason: string | null;
    payment: MoneyInput | null;
  }) => Observable<{ number: string; due: number; receipt: string | null }>;
}

/**
 * Old Generate Final Billing: the bill made at discharge, with a discount (left out: a corporate client's own) and what
 * is paid at the counter. The advance held is taken against it.
 */
@Component({
  selector: 'app-final-bill-dialog',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Final bill</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="flex flex-col gap-1">
        <p class="mb-3 text-sm">
          Total {{ data.total | currency: 'BDT' : 'symbol-narrow' }} · advance held
          {{ data.held | currency: 'BDT' : 'symbol-narrow' }}
        </p>
        @if (error()) {
          <p
            class="mb-3 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
            role="alert"
          >
            {{ error() }}
          </p>
        }
        <div class="grid gap-x-3 sm:grid-cols-2">
          <mat-form-field>
            <mat-label>Discount</mat-label>
            <input matInput type="number" min="0" formControlName="discount" />
            <mat-hint>Empty: the company's own discount, if any</mat-hint>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Discount reason</mat-label>
            <input matInput formControlName="discountReason" />
          </mat-form-field>
        </div>
        <div class="grid gap-x-3 sm:grid-cols-2">
          <mat-form-field>
            <mat-label>Paid now</mat-label>
            <input matInput type="number" min="0" formControlName="paid" data-testid="bill-paid" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Method</mat-label>
            <mat-select formControlName="method">
              @for (method of methods; track method) {
                <mat-option [value]="method">{{ method }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="bill-submit">
          Make the bill
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class FinalBillDialog {
  protected readonly data = inject<FinalBillDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<FinalBillDialog, unknown>>(MatDialogRef);

  protected readonly methods = PAYMENT_METHODS;
  protected readonly form = new FormGroup({
    discount: new FormControl<number | null>(null, [Validators.min(0)]),
    discountReason: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    paid: new FormControl<number | null>(null, [Validators.min(0)]),
    method: new FormControl<PaymentMethod>('cash', { nonNullable: true }),
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    if (value.discount && !value.discountReason.trim()) {
      this.error.set('Give the reason for the discount.');
      return;
    }
    submitDialog(
      this.dialogRef,
      { submitting: this.submitting, error: this.error },
      this.data.submit({
        discount: value.discount,
        discountReason: value.discountReason.trim() || null,
        payment: value.paid ? { amount: value.paid, method: value.method, reference: null } : null,
      }),
    );
  }
}

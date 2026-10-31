import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { Observable } from 'rxjs';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { submitDialog } from './dialog-submit';

export interface PassDialogData {
  readonly submit: (visitor: {
    visitorName: string;
    relation: string | null;
    mobileNo: string | null;
  }) => Observable<{ id: string; number: string }>;
}

/** Old Visiting Card: a pass for an attendant of the admitted patient. */
@Component({
  selector: 'app-pass-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ValidationMessagePipe,
  ],
  template: `
    <h2 mat-dialog-title>Visitor pass</h2>
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
          <mat-label>Visitor's name</mat-label>
          <input matInput formControlName="visitorName" required data-testid="pass-name" />
          <mat-error>{{ form.controls.visitorName.errors | validationMessage: "Visitor's name" }}</mat-error>
        </mat-form-field>
        <div class="grid gap-x-3 sm:grid-cols-2">
          <mat-form-field>
            <mat-label>Relation</mat-label>
            <input matInput formControlName="relation" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Mobile</mat-label>
            <input matInput formControlName="mobileNo" inputmode="tel" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="pass-submit">
          Issue
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class PassDialog {
  protected readonly data = inject<PassDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PassDialog, unknown>>(MatDialogRef);

  protected readonly form = new FormGroup({
    visitorName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    relation: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    mobileNo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.visitorName.trim()) {
      this.form.markAllAsTouched();
      return;
    }
    submitDialog(
      this.dialogRef,
      { submitting: this.submitting, error: this.error },
      this.data.submit({
        visitorName: value.visitorName.trim(),
        relation: value.relation.trim() || null,
        mobileNo: value.mobileNo.trim() || null,
      }),
    );
  }
}

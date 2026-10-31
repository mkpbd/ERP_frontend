import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Observable } from 'rxjs';
import { DISCHARGE_LABELS, DISCHARGE_TYPES, type DischargeType } from '../models/ipd.models';
import { submitDialog } from './dialog-submit';

export interface DischargeDialogData {
  readonly submit: (type: DischargeType, note: string | null) => Observable<void>;
}

/** The patient leaves on the day of the final bill: normal, or with a note (LAMA, referred, absconded, death). */
@Component({
  selector: 'app-discharge-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Discharge</h2>
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
          <mat-label>Discharge</mat-label>
          <mat-select formControlName="type">
            @for (type of types; track type) {
              <mat-option [value]="type">{{ labels[type] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Note</mat-label>
          <textarea matInput formControlName="note" rows="3"></textarea>
          <mat-hint>Needed for all but a normal discharge.</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="discharge-submit">
          Discharge
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class DischargeDialog {
  protected readonly data = inject<DischargeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<DischargeDialog, true>>(MatDialogRef);

  protected readonly types = DISCHARGE_TYPES;
  protected readonly labels = DISCHARGE_LABELS;
  protected readonly form = new FormGroup({
    type: new FormControl<DischargeType>('normal', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    const { type, note } = this.form.getRawValue();
    if (type !== 'normal' && !note.trim()) {
      this.error.set('Say why: left against advice, referred where, absconded, death.');
      return;
    }
    submitDialog(
      this.dialogRef,
      { submitting: this.submitting, error: this.error },
      this.data.submit(type, note.trim() || null),
    );
  }
}

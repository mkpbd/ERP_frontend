import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Observable } from 'rxjs';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { IpdApi } from '../services/ipd-api.service';
import { submitDialog } from './dialog-submit';

export interface BedDialogData {
  readonly title: string;
  readonly message: string;
  readonly confirmText: string;
  /** Reopening: the bed may be left out (the bed the patient left). */
  readonly bedOptional: boolean;
  readonly submit: (bedId: string | null, reason: string) => Observable<void>;
}

/** A free bed and the reason: moving a patient (old Cabin Transfer), or reopening a discharge. */
@Component({
  selector: 'app-bed-dialog',
  imports: [
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
        <p class="mb-3 max-w-prose text-sm">{{ data.message }}</p>
        @if (error()) {
          <p
            class="mb-3 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
            role="alert"
          >
            {{ error() }}
          </p>
        }
        <mat-form-field>
          <mat-label>Bed</mat-label>
          <mat-select formControlName="bedId" [required]="!data.bedOptional" data-testid="bed-choice">
            @if (data.bedOptional) {
              <mat-option [value]="null">The bed the patient left</mat-option>
            }
            @for (bed of freeBeds(); track bed.id) {
              <mat-option [value]="bed.id">{{ bed.label }}</mat-option>
            }
          </mat-select>
          <mat-error>{{ form.controls.bedId.errors | validationMessage: 'Bed' }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Reason</mat-label>
          <input matInput formControlName="reason" required />
          <mat-error>{{ form.controls.reason.errors | validationMessage: 'Reason' }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button matButton="filled" type="submit" [disabled]="submitting()">{{ data.confirmText }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class BedDialog {
  protected readonly data = inject<BedDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(IpdApi);
  private readonly dialogRef = inject<MatDialogRef<BedDialog, true>>(MatDialogRef);

  protected readonly form = new FormGroup({
    bedId: new FormControl<string | null>(null, this.data.bedOptional ? [] : [Validators.required]),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly board = rxResource({ stream: () => this.api.bedBoard() });
  protected readonly freeBeds = computed(() =>
    (this.board.hasValue() ? this.board.value().wards : []).flatMap((ward) =>
      ward.beds
        .filter((bed) => bed.status === 'available')
        .map((bed) => ({ id: bed.id, label: `${ward.name} · ${bed.code} (${bed.categoryName})` })),
    ),
  );

  protected submit(): void {
    const { bedId, reason } = this.form.getRawValue();
    if (this.form.invalid || !reason.trim()) {
      this.form.markAllAsTouched();
      return;
    }
    submitDialog(
      this.dialogRef,
      { submitting: this.submitting, error: this.error },
      this.data.submit(bedId, reason.trim()),
    );
  }
}

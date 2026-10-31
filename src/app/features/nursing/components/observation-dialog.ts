import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Observable } from 'rxjs';
import { submitDialog } from '../../../shared/utils/dialog-submit';
import {
  CONSCIOUSNESS,
  type Consciousness,
  type ObservationRequest,
  type VitalFlag,
} from '../models/nursing.models';

export interface ObservationDialogData {
  /** Who it is for, as the title says. */
  readonly patientName: string;
  readonly submit: (observation: ObservationRequest) => Observable<{ id: string; flags: VitalFlag[] }>;
}

const reading = (min: number, max: number) =>
  new FormControl<number | null>(null, [Validators.min(min), Validators.max(max)]);

/** Old follow-up sheet entry: the readings of a round, taken now or written up to a day later. */
@Component({
  selector: 'app-observation-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Observation · {{ data.patientName }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        @if (error()) {
          <p
            class="mb-3 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
            role="alert"
          >
            {{ error() }}
          </p>
        }
        <div class="grid grid-cols-2 gap-x-3 sm:grid-cols-4">
          <mat-form-field>
            <mat-label>Temp °F</mat-label>
            <input matInput type="number" step="0.1" formControlName="temperatureF" data-testid="obs-temp" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Pulse</mat-label>
            <input matInput type="number" formControlName="pulse" data-testid="obs-pulse" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Resp. rate</mat-label>
            <input matInput type="number" formControlName="respRate" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>SpO2 %</mat-label>
            <input matInput type="number" formControlName="spo2" data-testid="obs-spo2" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Systolic</mat-label>
            <input matInput type="number" formControlName="systolic" data-testid="obs-systolic" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Diastolic</mat-label>
            <input matInput type="number" formControlName="diastolic" data-testid="obs-diastolic" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Pain 0–10</mat-label>
            <input matInput type="number" formControlName="painScore" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Sugar mmol/L</mat-label>
            <input matInput type="number" step="0.1" formControlName="bloodSugar" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Intake ml</mat-label>
            <input matInput type="number" formControlName="intakeMl" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Output ml</mat-label>
            <input matInput type="number" formControlName="outputMl" />
          </mat-form-field>
          <mat-form-field class="col-span-2">
            <mat-label>Consciousness</mat-label>
            <mat-select formControlName="consciousness">
              <mat-option [value]="null">—</mat-option>
              @for (level of levels; track level) {
                <mat-option [value]="level">{{ level }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field class="w-full">
          <mat-label>Note</mat-label>
          <textarea matInput formControlName="note" rows="2"></textarea>
        </mat-form-field>
        <mat-form-field class="w-full sm:w-72">
          <mat-label>Taken at</mat-label>
          <input matInput type="datetime-local" formControlName="takenAt" />
          <mat-hint>Leave empty for now (up to a day back).</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="obs-submit">
          Record
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ObservationDialog {
  protected readonly data = inject<ObservationDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<ObservationDialog, { id: string; flags: VitalFlag[] }>>(MatDialogRef);

  protected readonly levels = CONSCIOUSNESS;
  protected readonly form = new FormGroup({
    temperatureF: reading(86, 113),
    pulse: reading(20, 250),
    respRate: reading(4, 80),
    systolic: reading(40, 300),
    diastolic: reading(20, 200),
    spo2: reading(40, 100),
    painScore: reading(0, 10),
    bloodSugar: reading(1, 40),
    intakeMl: reading(0, 20_000),
    outputMl: reading(0, 20_000),
    consciousness: new FormControl<Consciousness | null>(null),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    takenAt: new FormControl('', { nonNullable: true }),
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.error.set('A reading is outside what can be measured; check it.');
      return;
    }
    const { takenAt, note, ...vitals } = this.form.getRawValue();
    submitDialog(
      this.dialogRef,
      { submitting: this.submitting, error: this.error },
      this.data.submit({
        ...vitals,
        note: note.trim() || null,
        // datetime-local is local wall-clock time; new Date() reads it as local.
        takenAt: takenAt ? new Date(takenAt).toISOString() : null,
      }),
    );
  }
}

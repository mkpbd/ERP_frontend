import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import type { Observable } from 'rxjs';
import { OptionPicker, type PickerOption } from '../../../shared/components/option-picker';
import { IpdApi } from '../services/ipd-api.service';
import { submitDialog } from './dialog-submit';

export type DoctorsDialogData =
  | {
      readonly mode: 'consultant';
      readonly current: string | null;
      readonly submit: (doctorId: string) => Observable<void>;
    }
  | {
      readonly mode: 'additional';
      readonly current: readonly string[];
      readonly submit: (doctorIds: readonly string[]) => Observable<void>;
    };

/** Old Assigned Doctor Transfer (another consultant) and the doctors who also see the patient (up to ten). */
@Component({
  selector: 'app-doctors-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    OptionPicker,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.mode === 'consultant' ? 'Change the consultant' : 'Doctors who also see the patient' }}
    </h2>
    <mat-dialog-content class="flex flex-col gap-1">
      @if (error()) {
        <p
          class="mb-3 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
          role="alert"
        >
          {{ error() }}
        </p>
      }
      @if (data.mode === 'consultant') {
        <app-option-picker
          label="Consultant"
          [options]="consultantOptions()"
          [required]="true"
          [formControl]="consultant"
        />
      } @else {
        <mat-form-field>
          <mat-label>Doctors (up to 10)</mat-label>
          <mat-select [formControl]="additional" multiple>
            @for (doctor of doctorOptions(); track doctor.id) {
              <mat-option [value]="doctor.id">{{ doctor.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
      <button matButton="filled" type="button" (click)="submit()" [disabled]="submitting()">Save</button>
    </mat-dialog-actions>
  `,
})
export class DoctorsDialog {
  protected readonly data = inject<DoctorsDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(IpdApi);
  private readonly dialogRef = inject<MatDialogRef<DoctorsDialog, true>>(MatDialogRef);

  protected readonly consultant = new FormControl<string | null>(
    this.data.mode === 'consultant' ? this.data.current : null,
  );
  protected readonly additional = new FormControl<string[]>(
    this.data.mode === 'additional' ? [...this.data.current] : [],
    {
      nonNullable: true,
    },
  );
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly doctors = rxResource({ stream: () => this.api.doctors(this.data.mode === 'consultant') });
  protected readonly doctorOptions = computed<PickerOption[]>(() =>
    (this.doctors.hasValue() ? this.doctors.value() : []).map((doctor) => ({
      id: doctor.id,
      label: doctor.name,
      hint: doctor.degrees,
    })),
  );
  protected readonly consultantOptions = this.doctorOptions;

  protected submit(): void {
    const state = { submitting: this.submitting, error: this.error };
    if (this.data.mode === 'consultant') {
      if (!this.consultant.value) {
        this.error.set('Choose the consultant.');
        return;
      }
      submitDialog(this.dialogRef, state, this.data.submit(this.consultant.value));
      return;
    }
    if (this.additional.value.length > 10) {
      this.error.set('At most 10 doctors.');
      return;
    }
    submitDialog(this.dialogRef, state, this.data.submit(this.additional.value));
  }
}

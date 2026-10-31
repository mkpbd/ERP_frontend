import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, type ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/services/notification.service';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import { applyServerErrors } from '../../../shared/utils/form-errors';
import type { OtMasterRecord } from '../models/ot.models';
import { type MasterDefinition, toMasterBody } from '../models/ot-masters';
import { OtApi } from '../services/ot-api.service';

export interface MasterDialogData {
  readonly definition: MasterDefinition;
  /** Left out: a new record. */
  readonly record?: OtMasterRecord;
}

/** Adds or edits one OT master record; its fields come from the master's definition. */
@Component({
  selector: 'app-master-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    ValidationMessagePipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.record ? 'Edit' : 'New' }} {{ data.definition.noun }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="flex flex-col gap-3">
        @if (error()) {
          <p class="rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
            {{ error() }}
          </p>
        }
        @for (field of data.definition.fields; track field.key) {
          @switch (field.kind) {
            @case ('toggle') {
              <mat-slide-toggle [formControlName]="field.key">{{ field.label }}</mat-slide-toggle>
            }
            @case ('textarea') {
              <mat-form-field>
                <mat-label>{{ field.label }}</mat-label>
                <textarea
                  matInput
                  [formControlName]="field.key"
                  rows="5"
                  [required]="!!field.required"
                ></textarea>
                <mat-error>{{ form.controls[field.key]?.errors | validationMessage: field.label }}</mat-error>
              </mat-form-field>
            }
            @default {
              <mat-form-field>
                <mat-label>{{ field.label }}</mat-label>
                <input matInput [formControlName]="field.key" [required]="!!field.required" />
                <mat-error>{{ form.controls[field.key]?.errors | validationMessage: field.label }}</mat-error>
              </mat-form-field>
            }
          }
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Cancel</button>
        <button matButton="filled" type="submit" [disabled]="submitting()">
          {{ data.record ? 'Save' : 'Add' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class MasterDialog {
  protected readonly data = inject<MasterDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(OtApi);
  private readonly dialogRef = inject<MatDialogRef<MasterDialog, OtMasterRecord>>(MatDialogRef);

  protected readonly form = new FormGroup(
    Object.fromEntries(
      this.data.definition.fields.map((field) => {
        const current = this.data.record?.[field.key];
        if (field.kind === 'toggle') {
          return [
            field.key,
            new FormControl<string | boolean>(current === undefined ? true : current === true),
          ];
        }
        const validators: ValidatorFn[] = [];
        if (field.required) validators.push(Validators.required);
        if (field.max) validators.push(Validators.maxLength(field.max));
        return [
          field.key,
          new FormControl<string | boolean>(typeof current === 'string' ? current : '', { validators }),
        ];
      }),
    ) as Record<string, FormControl<string | boolean | null>>,
  );
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { definition, record } = this.data;
    const body = toMasterBody(definition, this.form.getRawValue() as Record<string, string | boolean>);
    const request$ = record
      ? this.api.updateMaster(definition.master, record.id, body)
      : this.api.createMaster(definition.master, body);
    this.submitting.set(true);
    this.error.set(null);
    this.dialogRef.disableClose = true;
    request$
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: (saved) => this.dialogRef.close(saved),
        error: (error: unknown) => {
          const apiError = toApiError(error);
          // A name or title already in use (ot_room_name_taken, procedure_title_taken, ...) is the first field's.
          const first = definition.fields[0]?.key ?? 'name';
          const codes = apiError.code.endsWith('_taken') ? { [apiError.code]: first } : {};
          const unplaced = applyServerErrors(this.form, apiError, codes);
          if (unplaced) this.error.set(describeError(apiError));
        },
      });
  }
}

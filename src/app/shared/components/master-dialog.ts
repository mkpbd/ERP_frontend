import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidatorFn,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import { toApiError } from '../../core/http/api-error';
import { describeError } from '../../core/services/notification.service';
import {
  type MasterDefinition,
  type MasterField,
  type MasterOption,
  type MasterValue,
  type RecordRow,
  toMasterBody,
} from '../models/record-master';
import { ValidationMessagePipe } from '../pipes/validation-message.pipe';
import { RecordsApi } from '../services/records-api.service';
import { applyServerErrors } from '../utils/form-errors';

export interface MasterDialogData {
  readonly definition: MasterDefinition;
  /** Left out: a new record. */
  readonly record?: RecordRow;
  /** The choices of `lookup` fields, by field key (loaded by the table). */
  readonly options?: Readonly<Record<string, readonly MasterOption[]>>;
}

/** At most `decimals` decimals (0: a whole number). */
function decimalsValidator(decimals: number): ValidatorFn {
  return (control: AbstractControl) => {
    const value = control.value as number | null;
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    const scaled = value * 10 ** decimals;
    return Math.abs(scaled - Math.round(scaled)) < 1e-6 ? null : { pattern: true };
  };
}

function controlFor(field: MasterField, current: unknown): FormControl<MasterValue> {
  const validators: ValidatorFn[] = [];
  if (field.required) validators.push(Validators.required);
  switch (field.kind) {
    case 'toggle':
      return new FormControl<MasterValue>(current === undefined ? true : current === true);
    case 'number': {
      if (field.min !== undefined) validators.push(Validators.min(field.min));
      if (field.maxValue !== undefined) validators.push(Validators.max(field.maxValue));
      validators.push(decimalsValidator(field.decimals ?? 0));
      const value = current ?? field.initial ?? null;
      return new FormControl<MasterValue>(value === null ? null : Number(value), { validators });
    }
    case 'select': {
      const value =
        typeof current === 'string' ? current : typeof field.initial === 'string' ? field.initial : null;
      return new FormControl<MasterValue>(current === undefined ? value : (current as string | null), {
        validators,
      });
    }
    case 'multi':
      return new FormControl<MasterValue>(
        Array.isArray(current)
          ? [...(current as string[])]
          : Array.isArray(field.initial)
            ? [...field.initial]
            : [],
      );
    default:
      if (field.max) validators.push(Validators.maxLength(field.max));
      return new FormControl<MasterValue>(
        typeof current === 'string' ? current : typeof field.initial === 'string' ? field.initial : '',
        { validators },
      );
  }
}

/** Adds or edits one master record; its fields come from the master's definition. */
@Component({
  selector: 'app-master-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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
              <mat-form-field class="w-full">
                <mat-label>{{ field.label }}</mat-label>
                <textarea
                  matInput
                  [formControlName]="field.key"
                  [rows]="field.rows ?? 5"
                  [required]="!!field.required"
                ></textarea>
                <mat-error>{{ form.controls[field.key]?.errors | validationMessage: field.label }}</mat-error>
              </mat-form-field>
            }
            @case ('number') {
              <mat-form-field class="w-full">
                <mat-label>{{ field.label }}</mat-label>
                <input
                  matInput
                  type="number"
                  [formControlName]="field.key"
                  [required]="!!field.required"
                  [attr.min]="field.min ?? null"
                  [attr.max]="field.maxValue ?? null"
                  [attr.step]="step(field)"
                />
                <mat-error>{{ form.controls[field.key]?.errors | validationMessage: field.label }}</mat-error>
              </mat-form-field>
            }
            @case ('select') {
              <mat-form-field class="w-full">
                <mat-label>{{ field.label }}</mat-label>
                <mat-select [formControlName]="field.key" [required]="!!field.required">
                  @if (!field.required) {
                    <mat-option [value]="null">{{ field.emptyLabel ?? '—' }}</mat-option>
                  }
                  @for (option of choices(field); track option.value) {
                    <mat-option [value]="option.value">{{ option.label }}</mat-option>
                  }
                </mat-select>
                <mat-error>{{ form.controls[field.key]?.errors | validationMessage: field.label }}</mat-error>
              </mat-form-field>
            }
            @case ('multi') {
              <div class="mb-2 flex flex-col gap-1">
                <span class="text-sm text-on-surface-variant" [id]="'master-' + field.key">{{
                  field.label
                }}</span>
                <mat-button-toggle-group
                  multiple
                  hideMultipleSelectionIndicator
                  class="flex-wrap"
                  [formControlName]="field.key"
                  [attr.aria-labelledby]="'master-' + field.key"
                >
                  @for (option of choices(field); track option.value) {
                    <mat-button-toggle [value]="option.value">{{ option.label }}</mat-button-toggle>
                  }
                </mat-button-toggle-group>
                @if (field.emptyLabel) {
                  <span class="text-xs text-on-surface-variant">None chosen: {{ field.emptyLabel }}.</span>
                }
              </div>
            }
            @default {
              <mat-form-field class="w-full">
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
  private readonly api = inject(RecordsApi);
  private readonly dialogRef = inject<MatDialogRef<MasterDialog, RecordRow>>(MatDialogRef);

  protected readonly form = new FormGroup(
    Object.fromEntries(
      this.data.definition.fields.map((field) => [
        field.key,
        controlFor(field, this.data.record?.[field.key]),
      ]),
    ) as Record<string, FormControl<MasterValue>>,
  );
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected choices(field: MasterField): readonly MasterOption[] {
    return field.options ?? this.data.options?.[field.key] ?? [];
  }

  protected step(field: MasterField): number {
    return field.decimals ? 1 / 10 ** field.decimals : 1;
  }

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { definition, record } = this.data;
    const body = toMasterBody(definition, this.form.getRawValue());
    const request$ = record
      ? this.api.update(definition.path, record.id, body)
      : this.api.create(definition.path, body);
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
          // A name or title already in use (ot_room_name_taken, antibiotic_name_taken, ...) is the first field's.
          const first = definition.fields[0]?.key ?? 'name';
          const codes = apiError.code.endsWith('_taken') ? { [apiError.code]: first } : {};
          const unplaced = applyServerErrors(this.form, apiError, codes);
          if (unplaced) this.error.set(describeError(apiError));
        },
      });
  }
}

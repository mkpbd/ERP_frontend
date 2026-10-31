import { Component, computed, effect, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ValidationMessagePipe } from '../../../shared/pipes/validation-message.pipe';
import type { LabResult } from '../models/lab.models';
import { LabApi } from '../services/lab-api.service';

export interface TextRequest {
  readonly narrative: string;
  readonly comment: string | null;
}

const MAX_NARRATIVE = 20_000;

/**
 * Old descriptive (histopathology) report entry: the report written as text, usually started from a template.
 * Plain text: line breaks are kept on the print.
 */
@Component({
  selector: 'app-text-entry',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ValidationMessagePipe,
  ],
  template: `
    @if (editable()) {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="app-card flex flex-col gap-2 p-5">
        <mat-form-field class="sm:w-96">
          <mat-label>Start from a template</mat-label>
          <mat-select (selectionChange)="useTemplate($event.value)" data-testid="text-template">
            @for (template of templates(); track template.id) {
              <mat-option [value]="template.id">
                {{ template.name }}
                @if (template.description) {
                  <span class="text-xs text-on-surface-variant"> · {{ template.description }}</span>
                }
              </mat-option>
            }
          </mat-select>
          <mat-hint>Its text is put in an empty report, or added at the end.</mat-hint>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Report</mat-label>
          <textarea
            matInput
            formControlName="narrative"
            rows="18"
            class="font-mono"
            required
            data-testid="text-narrative"
          ></textarea>
          <mat-hint align="end">{{ length() }} / {{ max }}</mat-hint>
          <mat-error>{{ form.controls.narrative.errors | validationMessage: 'Report' }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Comment</mat-label>
          <textarea matInput formControlName="comment" rows="2"></textarea>
        </mat-form-field>
        <div class="flex justify-end">
          <button matButton="filled" type="submit" [disabled]="busy()" data-testid="text-save">
            Save report
          </button>
        </div>
      </form>
    } @else {
      <section class="app-card p-5">
        @if (result().narrative) {
          <div class="whitespace-pre-wrap text-sm leading-relaxed">{{ result().narrative }}</div>
        } @else {
          <p class="text-sm text-on-surface-variant">Not written.</p>
        }
        @if (result().comment) {
          <p class="mt-3 text-sm"><b>Comment:</b> {{ result().comment }}</p>
        }
      </section>
    }
  `,
})
export class TextEntry {
  readonly result = input.required<LabResult>();
  readonly editable = input(false);
  readonly busy = input(false);
  readonly save = output<TextRequest>();

  private readonly api = inject(LabApi);
  private readonly templateList = rxResource({ stream: () => this.api.reportTemplates() });
  protected readonly templates = computed(() =>
    this.templateList.hasValue() ? this.templateList.value() : [],
  );
  protected readonly max = MAX_NARRATIVE;

  protected readonly form = new FormGroup({
    narrative: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NARRATIVE)],
    }),
    comment: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const result = this.result();
      this.form.reset({ narrative: result.narrative ?? '', comment: result.comment ?? '' });
    });
  }

  protected length(): number {
    return this.form.controls.narrative.value.length;
  }

  protected useTemplate(id: string): void {
    const template = this.templates().find((candidate) => candidate.id === id);
    if (!template) return;
    const current = this.form.controls.narrative.value.trimEnd();
    this.form.controls.narrative.setValue(current ? `${current}\n\n${template.body}` : template.body);
    this.form.controls.narrative.markAsDirty();
  }

  protected submit(): void {
    const { narrative, comment } = this.form.getRawValue();
    if (!narrative.trim()) {
      this.form.controls.narrative.setValue('');
      this.form.controls.narrative.markAsTouched();
      return;
    }
    if (this.form.invalid) return;
    this.save.emit({ narrative, comment: comment.trim() || null });
  }
}

import { Component, effect, input, output } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { LabResult } from '../models/lab.models';

export interface ValuesRequest {
  readonly values: readonly { parameterId: string; value: string | null }[];
  readonly comment: string | null;
}

/** A range as printed: "4.0 – 11.0", "< 200", "> 40", or its text. */
export function rangeText(range: {
  low: number | null;
  high: number | null;
  normalText: string | null;
}): string {
  if (range.normalText) return range.normalText;
  if (range.low !== null && range.high !== null) return `${range.low} – ${range.high}`;
  if (range.high !== null) return `< ${range.high}`;
  if (range.low !== null) return `> ${range.low}`;
  return '';
}

/** Old pathology result entry: a value for each parameter of the test's template, against the patient's range. */
@Component({
  selector: 'app-values-entry',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    @if (editable()) {
      @if (result().template.length === 0) {
        <p class="app-card p-5 text-sm text-on-surface-variant" role="status">
          This test has no parameters yet. The lab manager sets them before results are entered.
        </p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="app-card flex flex-col gap-3 p-5">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[520px] text-sm" aria-label="Values">
              <thead>
                <tr class="border-b border-outline-variant text-left">
                  <th class="py-2 font-medium">Parameter</th>
                  <th class="w-48 py-2 font-medium">Result</th>
                  <th class="py-2 font-medium">Unit</th>
                  <th class="py-2 font-medium">Normal range</th>
                </tr>
              </thead>
              <tbody formArrayName="values">
                @for (parameter of result().template; track parameter.parameterId; let i = $index) {
                  <tr class="border-b border-outline-variant">
                    <td class="py-1">{{ parameter.name }}</td>
                    <td class="py-1">
                      <mat-form-field class="w-44">
                        <mat-label>{{ parameter.name }}</mat-label>
                        <input
                          matInput
                          [formControlName]="i"
                          [attr.inputmode]="parameter.kind === 'numeric' ? 'decimal' : null"
                        />
                      </mat-form-field>
                    </td>
                    <td class="py-1">{{ parameter.unit }}</td>
                    <td class="py-1">{{ range(parameter) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <mat-form-field>
            <mat-label>Comment</mat-label>
            <textarea matInput formControlName="comment" rows="2"></textarea>
          </mat-form-field>
          <div class="flex justify-end">
            <button matButton="filled" type="submit" [disabled]="busy()">Save values</button>
          </div>
        </form>
      }
    } @else {
      <section class="app-card overflow-x-auto p-5">
        <table class="w-full text-sm" aria-label="Values">
          <thead>
            <tr class="border-b border-outline-variant text-left">
              <th class="py-2 font-medium">Parameter</th>
              <th class="py-2 font-medium">Result</th>
              <th class="py-2 font-medium">Unit</th>
              <th class="py-2 font-medium">Normal range</th>
            </tr>
          </thead>
          <tbody>
            @for (value of result().values; track $index) {
              <tr class="border-b border-outline-variant">
                <td class="py-1.5">{{ value.name }}</td>
                <td class="py-1.5" [class.font-bold]="value.flag">
                  {{ value.value }} {{ value.flag === 'high' ? 'H' : value.flag === 'low' ? 'L' : '' }}
                </td>
                <td class="py-1.5">{{ value.unit }}</td>
                <td class="py-1.5">{{ range(value) }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (result().comment) {
          <p class="mt-3 text-sm"><b>Comment:</b> {{ result().comment }}</p>
        }
      </section>
    }
  `,
})
export class ValuesEntry {
  readonly result = input.required<LabResult>();
  readonly editable = input(false);
  readonly busy = input(false);
  readonly save = output<ValuesRequest>();

  protected readonly form = new FormGroup({
    values: new FormArray<FormControl<string>>([]),
    comment: new FormControl('', { nonNullable: true }),
  });
  protected readonly range = rangeText;

  constructor() {
    effect(() => {
      const result = this.result();
      const entered = new Map(result.values.map((value) => [value.parameterId, value.value]));
      this.form.controls.values.clear({ emitEvent: false });
      for (const parameter of result.template) {
        this.form.controls.values.push(
          new FormControl(entered.get(parameter.parameterId) ?? '', { nonNullable: true }),
          {
            emitEvent: false,
          },
        );
      }
      this.form.controls.comment.setValue(result.comment ?? '');
    });
  }

  protected submit(): void {
    const { values, comment } = this.form.getRawValue();
    this.save.emit({
      values: this.result().template.map((parameter, index) => ({
        parameterId: parameter.parameterId,
        value: values[index]?.trim() || null,
      })),
      comment: comment.trim() || null,
    });
  }
}

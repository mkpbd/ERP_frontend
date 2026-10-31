import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { OptionPicker, type PickerOption } from '../../../shared/components/option-picker';
import { type CultureDraft, cultureProblem, cultureRequest, draftOf } from '../models/culture-form';
import { type CultureRequest, type LabResult, MAX_ORGANISMS, type Sensitivity } from '../models/lab.models';
import { LabApi } from '../services/lab-api.service';

type RowForm = FormGroup<{
  antibioticId: FormControl<string | null>;
  zone: FormControl<string>;
  results: FormArray<FormControl<Sensitivity | null>>;
}>;

const CYCLE: readonly (Sensitivity | null)[] = [null, 'S', 'I', 'R'];

/**
 * Old C/S report entry: the microscopy, how the culture grew, up to three organisms and the antibiogram (S, I or R of
 * each antibiotic against each organism, with its zone). Read only once verified.
 */
@Component({
  selector: 'app-culture-entry',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    OptionPicker,
  ],
  template: `
    @if (editable()) {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="flex flex-col gap-4">
        <section class="app-card p-5" aria-labelledby="microscopy-heading">
          <h2 id="microscopy-heading" class="mb-3 text-lg font-medium">Microscopy</h2>
          <div class="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
            <mat-form-field>
              <mat-label>Pus cells</mat-label>
              <input matInput formControlName="pusCells" placeholder="e.g. 8-10 /HPF" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Epithelial cells</mat-label>
              <input matInput formControlName="epithelialCells" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>RBC</mat-label>
              <input matInput formControlName="rbc" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Analyzer</mat-label>
              <input matInput formControlName="analyzer" />
            </mat-form-field>
          </div>
          <mat-form-field class="w-full">
            <mat-label>Microscopy note</mat-label>
            <input matInput formControlName="microscopyNote" />
          </mat-form-field>
        </section>

        <section class="app-card p-5" aria-labelledby="culture-heading">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="culture-heading" class="text-lg font-medium">Culture</h2>
            <mat-slide-toggle formControlName="growth" data-testid="culture-growth">Growth</mat-slide-toggle>
          </div>
          <div class="grid gap-x-3 sm:grid-cols-2">
            <mat-form-field>
              <mat-label>Growth type</mat-label>
              <mat-select formControlName="growthTypeId">
                <mat-option [value]="null">—</mat-option>
                @for (type of growthTypes(); track type.id) {
                  <mat-option [value]="type.id">{{ type.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field>
              <mat-label>Colony count</mat-label>
              <input matInput formControlName="colonyCount" placeholder="e.g. >10^5 CFU/ml" />
            </mat-form-field>
          </div>
          @if (growth()) {
            <div class="grid gap-x-3 sm:grid-cols-3" formArrayName="organismIds">
              @for (control of organisms.controls; track $index; let i = $index) {
                <app-option-picker
                  [label]="'Organism ' + (i + 1)"
                  [options]="organismOptions()"
                  [formControlName]="i"
                  [required]="i === 0"
                  [testId]="'culture-organism-' + (i + 1)"
                />
              }
            </div>
          }
          <div class="grid gap-x-3 sm:grid-cols-2">
            <mat-form-field>
              <mat-label>Incubation</mat-label>
              <input matInput formControlName="incubation" placeholder="e.g. 48 hours at 37 °C" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Culture media</mat-label>
              <input matInput formControlName="media" />
            </mat-form-field>
          </div>
          <mat-form-field class="w-full">
            <mat-label>Message</mat-label>
            <textarea matInput formControlName="message" rows="2" [matAutocomplete]="messageList"></textarea>
            <mat-hint>Pick a standard message or write one.</mat-hint>
            <mat-autocomplete #messageList="matAutocomplete">
              @for (message of messages(); track message.id) {
                <mat-option [value]="message.text">{{ message.text }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
        </section>

        @if (growth() && pickedOrganisms().length > 0) {
          <section class="app-card p-5" aria-labelledby="antibiogram-heading">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="antibiogram-heading" class="text-lg font-medium">Antibiogram</h2>
              <div class="flex gap-2">
                <button matButton type="button" (click)="addAll()">Add all antibiotics</button>
                <button
                  matButton="tonal"
                  type="button"
                  (click)="addRow()"
                  data-testid="culture-add-antibiotic"
                >
                  <mat-icon>add</mat-icon>
                  Antibiotic
                </button>
              </div>
            </div>
            <p class="mb-3 text-sm text-on-surface-variant">
              Click a result to step through S, I, R and blank, or focus it and type S, I or R.
            </p>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[640px] text-sm" aria-label="Antibiogram">
                <thead>
                  <tr class="border-b border-outline-variant text-left">
                    <th class="py-2 pr-2 font-medium">Antibiotic</th>
                    <th class="w-28 py-2 pr-2 font-medium">Zone (mm)</th>
                    @for (organism of pickedOrganisms(); track organism.slot) {
                      <th class="w-36 py-2 text-center font-medium italic">{{ organism.name }}</th>
                    }
                    <th class="w-12"><span class="app-sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody formArrayName="rows">
                  @for (row of rows.controls; track $index; let r = $index) {
                    <tr [formGroupName]="r" class="border-b border-outline-variant align-top">
                      <td class="pr-2 pt-2">
                        <app-option-picker
                          [label]="'Antibiotic ' + (r + 1)"
                          [options]="antibioticOptions()"
                          formControlName="antibioticId"
                        />
                      </td>
                      <td class="pr-2 pt-2">
                        <mat-form-field class="w-24">
                          <mat-label>Zone</mat-label>
                          <input matInput formControlName="zone" />
                        </mat-form-field>
                      </td>
                      @for (organism of pickedOrganisms(); track organism.slot) {
                        <td class="pt-3 text-center">
                          <button
                            matButton="outlined"
                            type="button"
                            class="!min-w-14 font-bold"
                            [attr.aria-label]="resultLabel(r, organism.slot, organism.name)"
                            (click)="cycle(r, organism.slot)"
                            (keydown)="typeResult($event, r, organism.slot)"
                          >
                            {{ resultOf(r, organism.slot) ?? '–' }}
                          </button>
                        </td>
                      }
                      <td class="pt-3">
                        <button
                          matIconButton
                          type="button"
                          [attr.aria-label]="'Remove antibiotic ' + (r + 1)"
                          (click)="rows.removeAt(r)"
                        >
                          <mat-icon>remove_circle_outline</mat-icon>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <section class="app-card p-5">
          <mat-form-field class="w-full">
            <mat-label>Comment</mat-label>
            <textarea matInput formControlName="comment" rows="2"></textarea>
          </mat-form-field>
          @if (problem()) {
            <p
              class="mb-3 rounded-card bg-error-container px-4 py-3 text-sm text-on-error-container"
              role="alert"
            >
              {{ problem() }}
            </p>
          }
          <div class="flex justify-end">
            <button matButton="filled" type="submit" [disabled]="busy()" data-testid="culture-save">
              Save culture
            </button>
          </div>
        </section>
      </form>
    } @else if (result().culture; as culture) {
      <section class="app-card p-5" aria-label="Culture">
        <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt class="text-on-surface-variant">Microscopy</dt>
          <dd>{{ microscopyText(culture) }}</dd>
          <dt class="text-on-surface-variant">Culture</dt>
          <dd>
            @if (culture.growth) {
              {{ culture.growthType ? culture.growthType + ': ' : '' }}
              <i>{{ organismNames(culture) }}</i>
              isolated
            } @else {
              {{ culture.growthType ?? 'No growth' }}
            }
          </dd>
          @if (culture.colonyCount) {
            <dt class="text-on-surface-variant">Colony count</dt>
            <dd>{{ culture.colonyCount }}</dd>
          }
          @if (culture.message) {
            <dt class="text-on-surface-variant">Message</dt>
            <dd>{{ culture.message }}</dd>
          }
        </dl>
        @if (culture.sensitivity.length) {
          <table class="mt-4 w-full text-sm" aria-label="Antibiogram">
            <thead>
              <tr class="border-b border-outline-variant text-left">
                <th class="py-2 font-medium">Antibiotic</th>
                <th class="py-2 font-medium">Zone</th>
                @for (organism of culture.organisms; track $index) {
                  <th class="py-2 text-center font-medium italic">{{ organism.name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of culture.sensitivity; track row.antibiotic) {
                <tr class="border-b border-outline-variant">
                  <td class="py-1.5">{{ row.antibiotic }}</td>
                  <td class="py-1.5">{{ row.zone ?? '' }}</td>
                  @for (value of row.results; track $index) {
                    <td class="py-1.5 text-center font-bold">{{ value ?? '' }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        }
        @if (result().comment) {
          <p class="mt-3 text-sm"><b>Comment:</b> {{ result().comment }}</p>
        }
      </section>
    } @else {
      <p class="text-sm text-on-surface-variant">Not entered.</p>
    }
  `,
})
export class CultureEntry {
  readonly result = input.required<LabResult>();
  readonly editable = input(false);
  readonly busy = input(false);
  readonly save = output<CultureRequest>();

  private readonly api = inject(LabApi);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    analyzer: [''],
    pusCells: [''],
    epithelialCells: [''],
    rbc: [''],
    microscopyNote: [''],
    growth: [true],
    growthTypeId: new FormControl<string | null>(null),
    organismIds: new FormArray(
      Array.from({ length: MAX_ORGANISMS }, () => new FormControl<string | null>(null)),
    ),
    colonyCount: [''],
    incubation: [''],
    media: [''],
    message: [''],
    rows: new FormArray<RowForm>([]),
    comment: [''],
  });
  protected readonly organisms = this.form.controls.organismIds;
  protected readonly rows = this.form.controls.rows;

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly growth = computed(() => this.value().growth ?? true);
  protected readonly problem = signal<string | null>(null);

  private readonly organismList = rxResource({ stream: () => this.api.organisms() });
  private readonly antibioticList = rxResource({ stream: () => this.api.antibiotics() });
  private readonly growthTypeList = rxResource({ stream: () => this.api.growthTypes() });
  private readonly messageList = rxResource({ stream: () => this.api.cultureMessages() });

  protected readonly organismOptions = computed<PickerOption[]>(() =>
    (this.organismList.hasValue() ? this.organismList.value() : []).map((row) => ({
      id: row.id,
      label: row.name,
    })),
  );
  protected readonly antibioticOptions = computed<PickerOption[]>(() =>
    (this.antibioticList.hasValue() ? this.antibioticList.value() : []).map((row) => ({
      id: row.id,
      label: row.name,
      hint: row.groupName,
    })),
  );
  protected readonly growthTypes = computed(() =>
    this.growthTypeList.hasValue() ? this.growthTypeList.value() : [],
  );
  protected readonly messages = computed(() => (this.messageList.hasValue() ? this.messageList.value() : []));

  /** The organisms picked, by slot: the antibiogram's columns. */
  protected readonly pickedOrganisms = computed(() => {
    const names = new Map(this.organismOptions().map((option) => [option.id, option.label]));
    const fromResult = new Map(
      (this.result().culture?.organisms ?? []).flatMap((organism) =>
        organism.organismId ? [[organism.organismId, organism.name] as const] : [],
      ),
    );
    return (this.value().organismIds ?? []).flatMap((id, slot) =>
      id ? [{ slot, name: names.get(id) ?? fromResult.get(id) ?? 'Organism' }] : [],
    );
  });

  constructor() {
    // Start from what was entered whenever the result (re)loads.
    effect(() => {
      const result = this.result();
      this.load(draftOf(result.culture, result.comment));
    });
  }

  protected microscopyText(culture: NonNullable<LabResult['culture']>): string {
    const parts = [
      culture.pusCells ? `Pus cells ${culture.pusCells}` : '',
      culture.epithelialCells ? `Epithelial cells ${culture.epithelialCells}` : '',
      culture.rbc ? `RBC ${culture.rbc}` : '',
    ].filter((part) => part !== '');
    return parts.join(' · ') || '—';
  }

  protected organismNames(culture: NonNullable<LabResult['culture']>): string {
    return culture.organisms.map((organism) => organism.name).join(', ');
  }

  private load(draft: CultureDraft): void {
    this.rows.clear({ emitEvent: false });
    for (const row of draft.rows)
      this.rows.push(this.row(row.antibioticId, row.zone, row.results), { emitEvent: false });
    const { rows: _rows, ...rest } = draft;
    this.form.reset({ ...rest, organismIds: [...draft.organismIds] });
    this.problem.set(null);
  }

  private row(
    antibioticId: string | null,
    zone = '',
    results: readonly (Sensitivity | null)[] = [],
  ): RowForm {
    return new FormGroup({
      antibioticId: new FormControl<string | null>(antibioticId),
      zone: new FormControl(zone, { nonNullable: true }),
      results: new FormArray(
        Array.from(
          { length: MAX_ORGANISMS },
          (_, slot) => new FormControl<Sensitivity | null>(results[slot] ?? null),
        ),
      ),
    });
  }

  protected addRow(): void {
    this.rows.push(this.row(null));
  }

  /** Every active antibiotic not in the table yet, in the list's order (by class). */
  protected addAll(): void {
    const present = new Set(this.rows.controls.map((row) => row.controls.antibioticId.value));
    for (const option of this.antibioticOptions()) {
      if (!present.has(option.id)) this.rows.push(this.row(option.id));
    }
  }

  protected resultOf(row: number, slot: number): Sensitivity | null {
    return this.rows.at(row).controls.results.at(slot).value;
  }

  protected resultLabel(row: number, slot: number, organism: string): string {
    const antibiotic =
      this.antibioticOptions().find((option) => option.id === this.rows.at(row).controls.antibioticId.value)
        ?.label ?? `Antibiotic ${row + 1}`;
    return `${antibiotic} against ${organism}: ${this.resultOf(row, slot) ?? 'blank'}`;
  }

  protected cycle(row: number, slot: number): void {
    const control = this.rows.at(row).controls.results.at(slot);
    control.setValue(CYCLE[(CYCLE.indexOf(control.value) + 1) % CYCLE.length] ?? null);
  }

  protected typeResult(event: KeyboardEvent, row: number, slot: number): void {
    const key = event.key.toUpperCase();
    const control = this.rows.at(row).controls.results.at(slot);
    if (key === 'S' || key === 'I' || key === 'R') control.setValue(key);
    else if (event.key === 'Backspace' || event.key === 'Delete') control.setValue(null);
    else return;
    event.preventDefault();
  }

  protected submit(): void {
    const draft = this.form.getRawValue() as CultureDraft;
    const problem = cultureProblem(draft);
    this.problem.set(problem);
    if (!problem) this.save.emit(cultureRequest(draft));
  }
}

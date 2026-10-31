import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  Observable,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import { OptionPicker, type PickerOption } from '../../../shared/components/option-picker';
import { submitDialog } from '../../../shared/utils/dialog-submit';
import {
  type OrderKind,
  type OrderRequest,
  type Route,
  ROUTE_LABELS,
  ROUTES,
  type Schedule,
  SCHEDULES,
} from '../models/nursing.models';
import { NursingApi } from '../services/nursing-api.service';

export interface OrderDialogData {
  readonly kind: OrderKind;
  readonly submit: (request: OrderRequest) => Observable<unknown>;
}

const SCHEDULE_LABELS: Record<Schedule, string> = {
  times: 'At set times each day',
  interval: 'Every so many hours',
  once: 'Once',
  prn: 'When needed',
};
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Old RxIpdTreatment and Non Medication Order entry: a medicine with dose and route, or nursing care, and when. */
@Component({
  selector: 'app-order-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    OptionPicker,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.kind === 'care' ? 'Order nursing care' : 'Order a medicine' }}</h2>
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
        @if (data.kind === 'medicine') {
          <app-option-picker
            label="Medicine from the pharmacy"
            placeholder="Brand or generic, two letters at least"
            [options]="medicineOptions()"
            (lookup)="medicineSearch.next($event)"
            testId="order-product"
            formControlName="productId"
          />
          @if (!value().productId) {
            <mat-form-field>
              <mat-label>Or write the medicine</mat-label>
              <input matInput formControlName="name" data-testid="order-name" />
            </mat-form-field>
          }
          <div class="grid gap-x-3 sm:grid-cols-2">
            <mat-form-field>
              <mat-label>Dose</mat-label>
              <input matInput formControlName="dose" required data-testid="order-dose" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Route</mat-label>
              <mat-select formControlName="route">
                @for (route of routes; track route) {
                  <mat-option [value]="route">{{ routeLabels[route] }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        } @else {
          <mat-form-field>
            <mat-label>Care</mat-label>
            <input
              matInput
              formControlName="name"
              required
              placeholder="Turn the patient, catheter care …"
              data-testid="order-name"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>How (optional)</mat-label>
            <input matInput formControlName="dose" />
          </mat-form-field>
        }
        <div class="grid gap-x-3 sm:grid-cols-2">
          <mat-form-field>
            <mat-label>When</mat-label>
            <mat-select formControlName="schedule" data-testid="order-schedule">
              @for (schedule of schedules; track schedule) {
                <mat-option [value]="schedule">{{ scheduleLabels[schedule] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (value().schedule === 'times') {
            <mat-form-field>
              <mat-label>Times</mat-label>
              <input
                matInput
                formControlName="times"
                placeholder="08:00, 14:00, 20:00"
                data-testid="order-times"
              />
            </mat-form-field>
          } @else if (value().schedule === 'interval') {
            <mat-form-field>
              <mat-label>Every (hours)</mat-label>
              <input
                matInput
                type="number"
                min="1"
                max="72"
                formControlName="intervalHours"
                data-testid="order-interval"
              />
            </mat-form-field>
          }
        </div>
        <mat-form-field>
          <mat-label>Note</mat-label>
          <input matInput formControlName="note" />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close [disabled]="submitting()">Back</button>
        <button matButton="filled" type="submit" [disabled]="submitting()" data-testid="order-submit">
          Order
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class OrderDialog {
  protected readonly data = inject<OrderDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(NursingApi);
  private readonly dialogRef = inject<MatDialogRef<OrderDialog, unknown>>(MatDialogRef);

  protected readonly routes = ROUTES;
  protected readonly routeLabels = ROUTE_LABELS;
  protected readonly schedules = SCHEDULES;
  protected readonly scheduleLabels = SCHEDULE_LABELS;
  protected readonly form = new FormGroup({
    productId: new FormControl<string | null>(null),
    name: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    dose: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    route: new FormControl<Route>('oral', { nonNullable: true }),
    schedule: new FormControl<Schedule>('times', { nonNullable: true }),
    times: new FormControl('', { nonNullable: true }),
    intervalHours: new FormControl<number | null>(null),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly medicineSearch = new Subject<string>();
  private readonly medicines = signal<readonly PickerOption[]>([]);
  protected readonly medicineOptions = computed(() => this.medicines());

  constructor() {
    this.medicineSearch
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter((q) => q.length >= 2),
        switchMap((q) => this.api.medicines(q).pipe(catchError(() => of([])))),
        takeUntilDestroyed(),
      )
      .subscribe((rows) =>
        this.medicines.set(rows.map((row) => ({ id: row.id, label: row.name, hint: row.genericName }))),
      );
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    const medicine = this.data.kind === 'medicine';
    const name =
      medicine && value.productId
        ? (this.medicines().find((row) => row.id === value.productId)?.label ?? '')
        : value.name.trim();
    if (!name) {
      this.error.set(medicine ? 'Choose the medicine or write it.' : 'Give the care ordered.');
      return;
    }
    if (medicine && !value.dose.trim()) {
      this.error.set('Give the dose.');
      return;
    }
    const times = value.times
      .split(/[\s,]+/)
      .map((time) => time.trim())
      .filter(Boolean);
    if (value.schedule === 'times' && (times.length === 0 || times.some((time) => !TIME.test(time)))) {
      this.error.set('Give the times of day as HH:MM, e.g. 08:00, 20:00.');
      return;
    }
    if (
      value.schedule === 'interval' &&
      !(value.intervalHours && value.intervalHours >= 1 && value.intervalHours <= 72)
    ) {
      this.error.set('Every 1 to 72 hours.');
      return;
    }
    submitDialog(
      this.dialogRef,
      { submitting: this.submitting, error: this.error },
      this.data.submit({
        kind: this.data.kind,
        productId: medicine ? value.productId : null,
        name,
        dose: value.dose.trim() || null,
        route: medicine ? value.route : null,
        schedule: value.schedule,
        times: value.schedule === 'times' ? times : [],
        intervalHours: value.schedule === 'interval' ? value.intervalHours : null,
        note: value.note.trim() || null,
      }),
    );
  }
}

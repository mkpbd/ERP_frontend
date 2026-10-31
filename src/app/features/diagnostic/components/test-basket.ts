import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { debounceTime, distinctUntilChanged, filter, Subject, switchMap } from 'rxjs';
import { OptionPicker, type PickerOption } from '../../../shared/components/option-picker';
import {
  type ChosenTest,
  type Department,
  MAX_BOOKING_TESTS,
  sumRates,
  type TestOption,
} from '../models/diagnostic.models';
import { DiagnosticApi } from '../services/diagnostic-api.service';

/**
 * The tests of a booking: searched (lab and imaging tests; lab only for a home collection; one department's when
 * given), each added once, with the total quoted.
 */
@Component({
  selector: 'app-test-basket',
  imports: [CurrencyPipe, ReactiveFormsModule, MatButtonModule, MatIconModule, OptionPicker],
  template: `
    <fieldset class="mb-2">
      <legend class="mb-2 text-sm font-medium">Tests</legend>
      @if (tests().length < max) {
        <app-option-picker
          label="Add a test"
          placeholder="Name, short name or code"
          [options]="options()"
          (lookup)="search.next($event)"
          [formControl]="pick"
          testId="booking-test"
        />
      }
      @if (tests().length) {
        <ul class="flex flex-col divide-y divide-outline-variant rounded-card border border-outline-variant">
          @for (test of tests(); track test.id) {
            <li class="flex items-center gap-2 px-3 py-1">
              <span class="flex-1">
                {{ test.name }}
                <span class="block text-xs text-on-surface-variant">{{ test.departmentName }}</span>
              </span>
              <span class="tabular-nums">{{ test.rate | currency: 'BDT' : '৳ ' }}</span>
              <button
                matIconButton
                type="button"
                [attr.aria-label]="'Remove ' + test.name"
                (click)="remove(test.id)"
              >
                <mat-icon>close</mat-icon>
              </button>
            </li>
          }
          <li class="flex justify-between px-3 py-2 font-medium">
            <span>Tests total</span>
            <span class="tabular-nums" data-testid="booking-tests-total">{{
              total() | currency: 'BDT' : '৳ '
            }}</span>
          </li>
        </ul>
      } @else {
        <p class="text-sm text-on-surface-variant">No test yet.</p>
      }
    </fieldset>
  `,
})
export class TestBasket {
  readonly tests = model<readonly ChosenTest[]>([]);
  readonly departments = input<readonly Department[]>([]);
  /** Only this department's tests (null: any). */
  readonly departmentId = input<string | null>(null);
  /** Only lab tests (a home collection). */
  readonly labOnly = input(false);

  private readonly api = inject(DiagnosticApi);
  protected readonly max = MAX_BOOKING_TESTS;
  protected readonly pick = new FormControl<string | null>(null);
  protected readonly search = new Subject<string>();
  private readonly found = signal<readonly TestOption[]>([]);

  private readonly byId = computed(
    () => new Map(this.departments().map((department) => [department.id, department])),
  );
  /** The tests found that may be booked here and are not chosen yet. */
  private readonly bookable = computed(() => {
    const chosen = new Set(this.tests().map((test) => test.id));
    return this.found().filter((test) => {
      const department = this.byId().get(test.departmentId);
      if (!department || department.kind === 'other' || chosen.has(test.id)) return false;
      if (this.labOnly() && department.kind !== 'lab') return false;
      return !this.departmentId() || test.departmentId === this.departmentId();
    });
  });
  protected readonly options = computed<PickerOption[]>(() =>
    this.bookable().map((test) => ({
      id: test.id,
      label: test.name,
      hint: `${this.byId().get(test.departmentId)?.name ?? ''} · ৳ ${test.rate.toFixed(2)}`,
    })),
  );
  protected readonly total = computed(() => sumRates(this.tests().map((test) => test.rate)));

  constructor() {
    this.search
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => this.api.tests(q)),
        takeUntilDestroyed(),
      )
      .subscribe({ next: (tests) => this.found.set(tests), error: () => this.found.set([]) });
    this.pick.valueChanges
      .pipe(
        filter((id): id is string => !!id),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        const test = this.found().find((option) => option.id === id);
        const department = test ? this.byId().get(test.departmentId) : undefined;
        if (test && department) {
          this.tests.update((tests) => [
            ...tests,
            {
              id: test.id,
              name: test.name,
              rate: test.rate,
              departmentId: department.id,
              departmentName: department.name,
              departmentKind: department.kind,
            },
          ]);
        }
        this.pick.setValue(null, { emitEvent: false });
      });
    this.search.next('');
  }

  protected remove(id: string): void {
    this.tests.update((tests) => tests.filter((test) => test.id !== id));
  }
}

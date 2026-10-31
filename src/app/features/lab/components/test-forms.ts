import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { NotificationService } from '../../../core/services/notification.service';
import { FORM_LABELS, type LabTest, REPORT_FORMS, type ReportForm } from '../models/lab.models';
import { LabApi } from '../services/lab-api.service';

/** How each lab test is reported: values against its parameters, a culture with its antibiogram, or written text. */
@Component({
  selector: 'app-test-forms',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  template: `
    <mat-form-field class="w-full sm:w-96">
      <mat-label>Find a lab test</mat-label>
      <mat-icon matPrefix aria-hidden="true">search</mat-icon>
      <input matInput [formControl]="search" placeholder="Name or code" data-testid="test-form-search" />
    </mat-form-field>
    <div class="h-1">
      @if (tests.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Finding tests" />
      }
    </div>
    @if (!query()) {
      <p class="text-sm text-on-surface-variant">
        Type part of a test's name. A test is reported as values unless set to a culture or a written report.
      </p>
    } @else {
      <ul class="app-card divide-y divide-outline-variant" aria-label="Lab tests">
        @for (test of rows(); track test.id) {
          <li class="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
            <span>{{ test.name }}</span>
            <mat-form-field class="w-64" subscriptSizing="dynamic">
              <mat-label>Reported as</mat-label>
              <mat-select
                [value]="test.form"
                [disabled]="!canManage() || saving() === test.id"
                (selectionChange)="setForm(test, $event.value)"
                [aria-label]="'How ' + test.name + ' is reported'"
              >
                @for (form of forms; track form) {
                  <mat-option [value]="form">{{ labels[form] }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </li>
        } @empty {
          <li class="px-4 py-3 text-sm text-on-surface-variant">No lab test matches.</li>
        }
      </ul>
    }
  `,
})
export class TestForms {
  private readonly api = inject(LabApi);
  private readonly notifications = inject(NotificationService);
  private readonly authorization = inject(Authorization);

  protected readonly forms = REPORT_FORMS;
  protected readonly labels = FORM_LABELS;
  protected readonly canManage = computed(() => this.authorization.can('lab:manage'));
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly query = toSignal(
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed()),
    { initialValue: '' },
  );
  protected readonly tests = rxResource({
    params: () => this.query().trim() || undefined,
    stream: ({ params }) => this.api.tests(params),
  });
  /** Forms changed here, shown before the list is fetched again. */
  private readonly changed = signal(new Map<string, ReportForm>());
  protected readonly rows = computed(() =>
    (this.tests.hasValue() ? this.tests.value() : []).map((test) => ({
      ...test,
      form: this.changed().get(test.id) ?? test.form,
    })),
  );
  protected readonly saving = signal<string | null>(null);

  protected setForm(test: LabTest, form: ReportForm): void {
    this.saving.set(test.id);
    this.api.setForm(test.id, form).subscribe({
      next: () => {
        this.saving.set(null);
        this.changed.update((map) => new Map(map).set(test.id, form));
        this.notifications.success(`${test.name}: ${FORM_LABELS[form].toLowerCase()}.`);
      },
      error: (error: unknown) => {
        this.saving.set(null);
        this.notifications.error(error);
        this.tests.reload();
      },
    });
  }
}

import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { debounceTime } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/components/page-header';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { BadgeTone, StatusBadge } from '../../../shared/components/status-badge';
import { Page, PAGE_SIZE_OPTIONS } from '../../../shared/models/page';
import type { AuditLogEntry, AuditLogQuery, AuditOutcome } from '../models/audit.models';
import { AuditApi } from '../services/audit-api.service';

const OUTCOME_TONES: Record<AuditOutcome, BadgeTone> = {
  success: 'success',
  failure: 'warning',
  denied: 'danger',
};

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

@Component({
  selector: 'app-audit-log-page',
  imports: [
    DatePipe,
    JsonPipe,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    PageHeader,
    EmptyState,
    ErrorState,
    StatusBadge,
  ],
  template: `
    <app-page-header
      title="Audit log"
      subtitle="Security-relevant changes and denied requests, newest first."
    />

    <form
      [formGroup]="filters"
      class="app-dense mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      role="search"
      aria-label="Filter audit log"
    >
      <mat-form-field>
        <mat-label>Action</mat-label>
        <input matInput formControlName="action" placeholder="e.g. auth.login" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Resource type</mat-label>
        <input matInput formControlName="resourceType" placeholder="e.g. user" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Outcome</mat-label>
        <mat-select formControlName="outcome">
          <mat-option value="">Any</mat-option>
          <mat-option value="success">Success</mat-option>
          <mat-option value="failure">Failure</mat-option>
          <mat-option value="denied">Denied</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Date range</mat-label>
        <mat-date-range-input [rangePicker]="picker">
          <input matStartDate formControlName="from" placeholder="Start date" />
          <input matEndDate formControlName="to" placeholder="End date" />
        </mat-date-range-input>
        <mat-datepicker-toggle matIconSuffix [for]="picker" />
        <mat-date-range-picker #picker />
      </mat-form-field>
    </form>

    @if (error(); as error) {
      <app-error-state [error]="error" title="Could not load the audit log" (retry)="entries.reload()" />
    } @else if (!entries.isLoading() && rows().length === 0) {
      <app-empty-state
        icon="history"
        title="No audit entries"
        message="Nothing matches the current filters."
      />
    } @else {
      <div class="app-card overflow-hidden">
        <div class="h-1">
          @if (entries.isLoading()) {
            <mat-progress-bar mode="indeterminate" aria-label="Loading audit entries" />
          }
        </div>
        <div class="overflow-x-auto">
          <table
            mat-table
            [dataSource]="rows()"
            class="min-w-[760px]"
            aria-label="Audit entries"
            [attr.aria-busy]="entries.isLoading()"
          >
            <ng-container matColumnDef="occurredAt">
              <th mat-header-cell *matHeaderCellDef>When</th>
              <td mat-cell *matCellDef="let entry" class="whitespace-nowrap">
                {{ entry.occurredAt | date: 'medium' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let entry" class="font-mono text-xs">{{ entry.action }}</td>
            </ng-container>
            <ng-container matColumnDef="resource">
              <th mat-header-cell *matHeaderCellDef>Resource</th>
              <td mat-cell *matCellDef="let entry">
                {{ entry.resourceType }}
                @if (entry.resourceId) {
                  <div
                    class="max-w-48 truncate font-mono text-xs text-on-surface-variant"
                    [title]="entry.resourceId"
                  >
                    {{ entry.resourceId }}
                  </div>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="outcome">
              <th mat-header-cell *matHeaderCellDef>Outcome</th>
              <td mat-cell *matCellDef="let entry">
                <app-status-badge [label]="entry.outcome" [tone]="outcomeTone(entry.outcome)" />
              </td>
            </ng-container>
            <ng-container matColumnDef="details">
              <th mat-header-cell *matHeaderCellDef>Details</th>
              <td mat-cell *matCellDef="let entry" class="py-2">
                <details>
                  <summary class="cursor-pointer text-sm text-primary">View</summary>
                  <dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 text-xs">
                    <dt class="text-on-surface-variant">Actor</dt>
                    <dd class="font-mono">{{ entry.actorUserId ?? 'anonymous' }}</dd>
                    <dt class="text-on-surface-variant">IP</dt>
                    <dd class="font-mono">{{ entry.ipAddress ?? '—' }}</dd>
                    <dt class="text-on-surface-variant">Request</dt>
                    <dd class="font-mono">{{ entry.requestId ?? '—' }}</dd>
                  </dl>
                  @if (hasMetadata(entry)) {
                    <pre class="mt-2 max-w-md overflow-x-auto rounded bg-surface-container p-2 text-xs">{{
                      entry.metadata | json
                    }}</pre>
                  }
                </details>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns" class="align-top"></tr>
          </table>
        </div>
        <mat-paginator
          [length]="total()"
          [pageIndex]="query().page - 1"
          [pageSize]="query().pageSize"
          [pageSizeOptions]="pageSizeOptions"
          (page)="page($event)"
          aria-label="Select page of audit entries"
        />
      </div>
    }
  `,
})
export class AuditLogPage {
  private readonly api = inject(AuditApi);

  protected readonly columns = ['occurredAt', 'action', 'resource', 'outcome', 'details'];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  protected readonly filters = new FormGroup({
    action: new FormControl('', { nonNullable: true }),
    resourceType: new FormControl('', { nonNullable: true }),
    outcome: new FormControl<AuditOutcome | ''>('', { nonNullable: true }),
    from: new FormControl<Date | null>(null),
    to: new FormControl<Date | null>(null),
  });

  protected readonly query = signal<AuditLogQuery>({ page: 1, pageSize: 20 });
  protected readonly entries = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.list(params),
  });

  private readonly lastPage = linkedSignal<Page<AuditLogEntry> | undefined, Page<AuditLogEntry> | undefined>({
    source: () => (this.entries.hasValue() ? this.entries.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });
  protected readonly rows = computed(() => this.lastPage()?.items ?? []);
  protected readonly total = computed(() => this.lastPage()?.total ?? 0);
  protected readonly error = computed(() => {
    const error = this.entries.error();
    return error ? toApiError(error) : null;
  });

  constructor() {
    this.filters.valueChanges.pipe(debounceTime(350), takeUntilDestroyed()).subscribe(() => {
      if (this.filters.invalid) return;
      const { action, resourceType, outcome, from, to } = this.filters.getRawValue();
      this.query.update((query) => ({
        page: 1,
        pageSize: query.pageSize,
        action: action.trim() || undefined,
        resourceType: resourceType.trim() || undefined,
        outcome: outcome || undefined,
        from: from ?? undefined,
        to: to ? endOfDay(to) : undefined,
      }));
    });
  }

  protected page(event: PageEvent): void {
    const page = event.pageSize === this.query().pageSize ? event.pageIndex + 1 : 1;
    this.query.update((query) => ({ ...query, page, pageSize: event.pageSize }));
  }

  protected outcomeTone(outcome: AuditOutcome): BadgeTone {
    return OUTCOME_TONES[outcome];
  }

  protected hasMetadata(entry: AuditLogEntry): boolean {
    return Object.keys(entry.metadata).length > 0;
  }
}

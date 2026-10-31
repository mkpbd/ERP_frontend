import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
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
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { ReportDownloadService } from '../../../core/services/report-download.service';
import { PageHeader } from '../../../shared/components/page-header';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { PAGE_SIZE_OPTIONS } from '../../../shared/models/page';
import { OT_CASE_STATUSES, type OtCaseStatus, STATUS_LABELS, STATUS_TONES, toDay } from '../models/ot.models';
import { OtApi } from '../services/ot-api.service';
import { OtCasesStore } from '../state/ot-cases.store';

/** Every operation, by status, period and room; the OT register prints the same period. */
@Component({
  selector: 'app-ot-cases-page',
  providers: [OtCasesStore],
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    PageHeader,
    EmptyState,
    ErrorState,
    StatusBadge,
  ],
  template: `
    <app-page-header title="Operations" subtitle="Every operation asked for, by status, period and room.">
      <button matButton="outlined" type="button" (click)="printRegister()" [disabled]="!canPrint()">
        <mat-icon>print</mat-icon>
        OT register
      </button>
    </app-page-header>

    <form
      [formGroup]="filters"
      class="app-dense mb-4 flex flex-col gap-3 sm:flex-row"
      aria-label="Filter operations"
    >
      <mat-form-field class="sm:w-44">
        <mat-label>Status</mat-label>
        <mat-select [value]="store.query().status ?? ''" (selectionChange)="setStatus($event.value)">
          <mat-option value="">All</mat-option>
          @for (status of statuses; track status) {
            <mat-option [value]="status">{{ labels[status] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field class="sm:w-64">
        <mat-label>Period</mat-label>
        <mat-hint>The booked day, else the day asked for</mat-hint>
        <mat-date-range-input [rangePicker]="picker">
          <input matStartDate formControlName="from" placeholder="From" />
          <input matEndDate formControlName="to" placeholder="To" />
        </mat-date-range-input>
        <mat-datepicker-toggle matIconSuffix [for]="picker" />
        <mat-date-range-picker #picker />
      </mat-form-field>
      <mat-form-field class="sm:w-48">
        <mat-label>Room</mat-label>
        <mat-select
          [value]="store.query().roomId ?? ''"
          (selectionChange)="store.setRoom($event.value || undefined)"
        >
          <mat-option value="">Any</mat-option>
          @for (room of rooms(); track room.id) {
            <mat-option [value]="room.id">{{ room.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </form>

    @if (store.error(); as error) {
      <app-error-state [error]="error" title="Could not load operations" (retry)="store.reload()" />
    } @else if (store.isEmpty()) {
      <app-empty-state
        icon="medical_services"
        [title]="store.hasFilters() ? 'No operations match your filters' : 'No operations yet'"
      >
        @if (store.hasFilters()) {
          <button matButton type="button" (click)="clearFilters()">Clear filters</button>
        }
      </app-empty-state>
    } @else {
      <div class="app-card relative overflow-hidden">
        <div class="h-1">
          @if (store.loading()) {
            <mat-progress-bar mode="indeterminate" aria-label="Loading operations" />
          }
        </div>
        <div class="overflow-x-auto">
          <table
            mat-table
            [dataSource]="store.cases()"
            class="min-w-[760px]"
            aria-label="Operations"
            [attr.aria-busy]="store.loading()"
          >
            <ng-container matColumnDef="number">
              <th mat-header-cell *matHeaderCellDef>Number</th>
              <td mat-cell *matCellDef="let row">
                <a [routerLink]="['/ot/cases', row.id]" class="font-medium text-primary hover:underline">{{
                  row.number
                }}</a>
              </td>
            </ng-container>
            <ng-container matColumnDef="patient">
              <th mat-header-cell *matHeaderCellDef>Patient</th>
              <td mat-cell *matCellDef="let row">
                {{ row.patientName }}
                <div class="text-xs text-on-surface-variant">
                  UHID {{ row.uhid }} · {{ row.admissionNumber }}
                </div>
              </td>
            </ng-container>
            <ng-container matColumnDef="operation">
              <th mat-header-cell *matHeaderCellDef>Operation</th>
              <td mat-cell *matCellDef="let row">
                {{ row.operationName }}
                <div class="text-xs text-on-surface-variant">{{ row.surgeonName }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="when">
              <th mat-header-cell *matHeaderCellDef>When</th>
              <td mat-cell *matCellDef="let row">
                @if (row.scheduledFrom) {
                  {{ row.scheduledFrom | date: 'medium' }}
                  <div class="text-xs text-on-surface-variant">{{ row.otRoomName }}</div>
                } @else {
                  <span class="text-on-surface-variant"
                    >Asked for {{ row.requestedFor | date: 'mediumDate' }}</span
                  >
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <app-status-badge [label]="labelOf(row.status)" [tone]="toneOf(row.status)" />
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
        <mat-paginator
          [length]="store.total()"
          [pageIndex]="store.query().page - 1"
          [pageSize]="store.query().pageSize"
          [pageSizeOptions]="pageSizeOptions"
          (page)="page($event)"
          aria-label="Select page of operations"
        />
      </div>
    }
  `,
})
export class OtCasesPage {
  protected readonly store = inject(OtCasesStore);
  private readonly api = inject(OtApi);
  private readonly reports = inject(ReportDownloadService);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = ['number', 'patient', 'operation', 'when', 'status'];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly statuses = OT_CASE_STATUSES;
  protected readonly labels = STATUS_LABELS;
  protected readonly filters = new FormGroup({
    from: new FormControl<Date | null>(null),
    to: new FormControl<Date | null>(null),
  });

  private readonly roomsResource = rxResource({ stream: () => this.api.rooms() });
  protected readonly rooms = computed(() =>
    this.roomsResource.hasValue() ? this.roomsResource.value() : [],
  );
  /** The register needs a whole period. */
  protected readonly canPrint = computed(() => !!this.store.query().from && !!this.store.query().to);

  constructor() {
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(({ from, to }) => {
      // Wait for both ends of a range being picked, or for the range being cleared.
      if (!!from === !!to) this.store.setPeriod(from ? toDay(from) : undefined, to ? toDay(to) : undefined);
    });
  }

  protected labelOf(status: OtCaseStatus): string {
    return STATUS_LABELS[status];
  }

  protected toneOf(status: OtCaseStatus) {
    return STATUS_TONES[status];
  }

  protected setStatus(status: OtCaseStatus | ''): void {
    this.store.setStatus(status || undefined);
  }

  protected page(event: PageEvent): void {
    this.store.setPage(event.pageIndex, event.pageSize);
  }

  protected clearFilters(): void {
    this.filters.reset({ from: null, to: null }, { emitEvent: false });
    this.store.clearFilters();
  }

  protected printRegister(): void {
    const { from, to, roomId } = this.store.query();
    if (!from || !to) return;
    this.reports
      .download(
        'hospital.ot-register',
        { from, to, ...(roomId ? { roomId } : {}) },
        `ot-register-${from}-${to}`,
      )
      .subscribe({ error: (error: unknown) => this.notifications.error(error) });
  }
}

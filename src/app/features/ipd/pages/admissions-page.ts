import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeader } from '../../../shared/components/page-header';
import { EmptyState, ErrorState } from '../../../shared/components/state-views';
import { StatusBadge } from '../../../shared/components/status-badge';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PAGE_SIZE_OPTIONS } from '../../../shared/models/page';
import { AdmitDialog } from '../components/admit-dialog';
import { type AdmissionStatus, STATUS_LABELS, STATUS_TONES } from '../models/ipd.models';
import { AdmissionsStore } from '../state/admissions.store';

/** Old IPD patient list: the patients in now (or discharged, or all), found by name, UHID or admission number. */
@Component({
  selector: 'app-admissions-page',
  providers: [AdmissionsStore],
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    PageHeader,
    EmptyState,
    ErrorState,
    StatusBadge,
    HasPermissionDirective,
  ],
  template: `
    <app-page-header title="Admissions" subtitle="Patients in the hospital, and those who have left.">
      <a matButton="outlined" routerLink="/ipd/beds">
        <mat-icon>bed</mat-icon>
        Bed board
      </a>
      <button
        matButton="filled"
        type="button"
        *appHasPermission="['ipd:admit', 'patient:read', 'opd:read']"
        (click)="admit()"
        data-testid="admit"
      >
        <mat-icon>add</mat-icon>
        Admit patient
      </button>
    </app-page-header>

    <div class="app-dense mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <mat-form-field class="flex-1">
        <mat-label>Search</mat-label>
        <mat-icon matPrefix aria-hidden="true">search</mat-icon>
        <input matInput [formControl]="search" placeholder="Name, UHID or admission number" />
      </mat-form-field>
      <mat-button-toggle-group
        [value]="store.query().status ?? ''"
        (change)="setStatus($event.value)"
        aria-label="Which admissions"
      >
        <mat-button-toggle value="admitted">In</mat-button-toggle>
        <mat-button-toggle value="discharged">Discharged</mat-button-toggle>
        <mat-button-toggle value="">All</mat-button-toggle>
      </mat-button-toggle-group>
    </div>

    @if (store.error(); as error) {
      <app-error-state [error]="error" title="Could not load admissions" (retry)="store.reload()" />
    } @else if (store.isEmpty()) {
      <app-empty-state icon="hotel" title="No admissions here" />
    } @else {
      <div class="app-card relative overflow-hidden">
        <div class="h-1">
          @if (store.loading()) {
            <mat-progress-bar mode="indeterminate" aria-label="Loading admissions" />
          }
        </div>
        <div class="overflow-x-auto">
          <table mat-table [dataSource]="store.items()" class="min-w-[720px]" aria-label="Admissions">
            <ng-container matColumnDef="number">
              <th mat-header-cell *matHeaderCellDef>Admission</th>
              <td mat-cell *matCellDef="let row">
                <a
                  [routerLink]="['/ipd/admissions', row.id]"
                  class="font-medium text-primary hover:underline"
                  >{{ row.number }}</a
                >
              </td>
            </ng-container>
            <ng-container matColumnDef="patient">
              <th mat-header-cell *matHeaderCellDef>Patient</th>
              <td mat-cell *matCellDef="let row">
                {{ row.patientName }}
                <div class="text-xs text-on-surface-variant">UHID {{ row.uhid }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="bed">
              <th mat-header-cell *matHeaderCellDef>Bed</th>
              <td mat-cell *matCellDef="let row">
                {{ row.bedCode ?? '—' }}
                <div class="text-xs text-on-surface-variant">{{ row.wardName }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="doctor">
              <th mat-header-cell *matHeaderCellDef>Consultant</th>
              <td mat-cell *matCellDef="let row">{{ row.doctorName ?? '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="admittedAt">
              <th mat-header-cell *matHeaderCellDef>Admitted</th>
              <td mat-cell *matCellDef="let row">{{ row.admittedAt | date: 'medium' }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <app-status-badge [label]="label(row.status)" [tone]="tone(row.status)" />
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
          aria-label="Select page of admissions"
        />
      </div>
    }
  `,
})
export class AdmissionsPage {
  protected readonly store = inject(AdmissionsStore);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected readonly columns = ['number', 'patient', 'bed', 'doctor', 'admittedAt', 'status'];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly search = new FormControl('', { nonNullable: true });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => this.store.setSearch(value));
  }

  protected label(status: AdmissionStatus): string {
    return STATUS_LABELS[status];
  }

  protected tone(status: AdmissionStatus) {
    return STATUS_TONES[status];
  }

  protected setStatus(status: AdmissionStatus | ''): void {
    this.store.setStatus(status || undefined);
  }

  protected page(event: PageEvent): void {
    this.store.setPage(event.pageIndex, event.pageSize);
  }

  protected admit(): void {
    this.dialog
      .open<AdmitDialog, void, { id: string; number: string }>(AdmitDialog, {
        width: '40rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((admitted) => {
        if (!admitted) return;
        this.notifications.success(`Admitted as ${admitted.number}.`);
        void this.router.navigate(['/ipd/admissions', admitted.id]);
      });
  }
}

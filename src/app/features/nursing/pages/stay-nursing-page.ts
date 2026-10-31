import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../../shared/components/page-header';
import { ErrorState, LoadingState } from '../../../shared/components/state-views';
import { ChartPanel } from '../components/chart-panel';
import { ObservationSheet } from '../components/observation-sheet';
import { toDay } from '../models/nursing.models';
import { StayNursingStore } from '../state/stay-nursing.store';

/** One stay's nursing records on a day: observations, the medication chart and the care chart. */
@Component({
  selector: 'app-stay-nursing-page',
  providers: [StayNursingStore],
  imports: [
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTabsModule,
    PageHeader,
    ErrorState,
    LoadingState,
    ChartPanel,
    ObservationSheet,
  ],
  template: `
    @if (store.error(); as error) {
      <app-error-state
        [error]="error"
        [title]="error.status === 404 ? 'Admission not found' : 'Could not load the records'"
        [retryable]="error.status !== 404"
        (retry)="store.reload()"
      />
    } @else if (store.admission(); as admission) {
      <app-page-header [title]="admission.patientName" [subtitle]="'Nursing records · ' + admission.number">
        <a matButton="outlined" [routerLink]="['/ipd/admissions', admission.id]">
          <mat-icon>hotel</mat-icon>
          The stay
        </a>
      </app-page-header>
      <div class="app-dense mb-2 flex flex-wrap items-center gap-2">
        <button matIconButton type="button" aria-label="Previous day" (click)="shift(-1)">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <mat-form-field class="w-44">
          <mat-label>Day</mat-label>
          <input matInput [matDatepicker]="picker" [value]="date()" (dateChange)="pickDay($event)" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>
        <button matIconButton type="button" aria-label="Next day" (click)="shift(1)">
          <mat-icon>chevron_right</mat-icon>
        </button>
        @if (!store.admitted()) {
          <span class="text-sm text-on-surface-variant"
            >The patient has left: the records are read only.</span
          >
        }
      </div>
      <div class="h-1">
        @if (store.loading()) {
          <mat-progress-bar mode="indeterminate" aria-label="Loading the records" />
        }
      </div>
      <mat-tab-group mat-stretch-tabs="false" animationDuration="0ms">
        <mat-tab label="Observations">
          <div class="pt-4"><app-observation-sheet /></div>
        </mat-tab>
        <mat-tab label="Medicines">
          <div class="pt-4"><app-chart-panel kind="medicine" /></div>
        </mat-tab>
        <mat-tab label="Nursing care">
          <div class="pt-4"><app-chart-panel kind="care" /></div>
        </mat-tab>
      </mat-tab-group>
    } @else if (store.loading()) {
      <app-loading-state label="Loading the records…" />
    }
  `,
})
export class StayNursingPage {
  protected readonly store = inject(StayNursingStore);
  protected readonly date = computed(() => new Date(`${this.store.day()}T00:00:00`));

  protected pickDay(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) this.store.day.set(toDay(event.value));
  }

  protected shift(days: number): void {
    const date = new Date(`${this.store.day()}T00:00:00`);
    date.setDate(date.getDate() + days);
    this.store.day.set(toDay(date));
  }
}

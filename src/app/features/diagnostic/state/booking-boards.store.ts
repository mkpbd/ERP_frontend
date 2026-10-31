import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { toApiError } from '../../../core/http/api-error';
import { addDays, toDay } from '../models/diagnostic.models';
import { DiagnosticApi } from '../services/diagnostic-api.service';

/** The day a board shows, moved a day at a time. */
abstract class DayBoard {
  readonly day = signal(toDay(new Date()));
  readonly isToday = computed(() => this.day() === toDay(new Date()));

  setDay(day: string): void {
    this.day.set(day);
  }

  shift(days: number): void {
    this.day.update((day) => addDays(day, days));
  }

  today(): void {
    this.day.set(toDay(new Date()));
  }
}

/** Old test appointment dashboard: one day's bookings (one department's, or all) and its windows' places. */
@Injectable()
export class AppointmentBoardStore extends DayBoard {
  private readonly api = inject(DiagnosticApi);
  readonly departmentId = signal<string | null>(null);

  private readonly resource = rxResource({
    params: () => ({ day: this.day(), departmentId: this.departmentId() }),
    stream: ({ params }) => this.api.appointments({ from: params.day, departmentId: params.departmentId }),
  });
  private readonly places = rxResource({
    params: () => ({ day: this.day(), departmentId: this.departmentId() }),
    stream: ({ params }) => this.api.availability(params.day, params.departmentId),
  });

  readonly board = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly windows = computed(() => (this.places.hasValue() ? this.places.value() : []));
  readonly loading = computed(() => this.resource.isLoading() || this.places.isLoading());
  readonly error = computed(() => {
    const error = this.resource.error();
    return error ? toApiError(error) : null;
  });

  reload(): void {
    this.resource.reload();
    this.places.reload();
  }
}

/** One day's home collections; `collectorId` 'me' for a collector's own. */
@Injectable()
export class CollectionBoardStore extends DayBoard {
  private readonly api = inject(DiagnosticApi);
  readonly areaId = signal<string | null>(null);
  readonly collectorId = signal<string | null>(null);

  private readonly resource = rxResource({
    params: () => ({ day: this.day(), areaId: this.areaId(), collectorId: this.collectorId() }),
    stream: ({ params }) =>
      this.api.collections({ from: params.day, areaId: params.areaId, collectorId: params.collectorId }),
  });

  readonly board = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => {
    const error = this.resource.error();
    return error ? toApiError(error) : null;
  });

  reload(): void {
    this.resource.reload();
  }
}

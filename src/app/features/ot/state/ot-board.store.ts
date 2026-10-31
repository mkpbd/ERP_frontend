import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { toApiError } from '../../../core/http/api-error';
import { addDays, toDay } from '../models/ot.models';
import { OtApi } from '../services/ot-api.service';

/** State of the OT board: one day's rooms and their operations, and the operations waiting for a room. */
@Injectable()
export class OtBoardStore {
  private readonly api = inject(OtApi);

  readonly day = signal(toDay(new Date()));

  private readonly resource = rxResource({
    params: () => this.day(),
    stream: ({ params }) => this.api.board(params),
  });

  readonly board = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => {
    const error = this.resource.error();
    return error ? toApiError(error) : null;
  });
  readonly isToday = computed(() => this.day() === toDay(new Date()));
  readonly booked = computed(
    () => this.board()?.rooms.reduce((sum, room) => sum + room.cases.length, 0) ?? 0,
  );

  setDay(day: string): void {
    this.day.set(day);
  }

  shift(days: number): void {
    this.day.update((day) => addDays(day, days));
  }

  today(): void {
    this.day.set(toDay(new Date()));
  }

  reload(): void {
    this.resource.reload();
  }
}

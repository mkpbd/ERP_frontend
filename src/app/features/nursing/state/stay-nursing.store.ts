import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, map, Observable, tap } from 'rxjs';
import { Authorization } from '../../../core/authorization/authorization.service';
import { toApiError } from '../../../core/http/api-error';
import { toDay } from '../models/nursing.models';
import { NursingApi } from '../services/nursing-api.service';

/** One stay's nursing records on a day: the observation sheet, the medicine and care charts, and the orders. */
@Injectable()
export class StayNursingStore {
  readonly api = inject(NursingApi);
  private readonly authorization = inject(Authorization);

  readonly admissionId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    {
      requireSync: true,
    },
  );
  readonly day = signal(toDay(new Date()));

  private readonly key = computed(() =>
    this.admissionId() ? { id: this.admissionId(), day: this.day() } : undefined,
  );
  private readonly observationResource = rxResource({
    params: () => this.key(),
    stream: ({ params }) => this.api.observations(params.id, params.day, params.day),
  });
  private readonly medicineResource = rxResource({
    params: () => this.key(),
    stream: ({ params }) => this.api.chart(params.id, params.day, 'medicine'),
  });
  private readonly careResource = rxResource({
    params: () => this.key(),
    stream: ({ params }) => this.api.chart(params.id, params.day, 'care'),
  });
  private readonly orderResource = rxResource({
    params: () => this.admissionId() || undefined,
    stream: ({ params }) => this.api.orders(params),
  });

  readonly observations = computed(() =>
    this.observationResource.hasValue() ? this.observationResource.value() : [],
  );
  readonly medicines = computed(() =>
    this.medicineResource.hasValue() ? this.medicineResource.value() : null,
  );
  readonly care = computed(() => (this.careResource.hasValue() ? this.careResource.value() : null));
  readonly orders = computed(() => (this.orderResource.hasValue() ? this.orderResource.value() : []));
  /** The stay as the chart tells it. */
  readonly admission = computed(() => this.medicines()?.admission ?? this.care()?.admission ?? null);
  readonly error = computed(() => {
    const error = this.medicineResource.error() ?? this.observationResource.error();
    return error ? toApiError(error) : null;
  });
  readonly loading = computed(
    () => this.medicineResource.isLoading() || this.observationResource.isLoading(),
  );
  readonly admitted = computed(() => this.admission()?.status === 'admitted');
  readonly canWrite = computed(() => this.authorization.can('emr:write') && this.admitted());
  readonly canOrder = computed(() => this.authorization.can('emr:order') && this.admitted());
  readonly isToday = computed(() => this.day() === toDay(new Date()));

  readonly pending = signal(false);

  reload(): void {
    this.observationResource.reload();
    this.medicineResource.reload();
    this.careResource.reload();
    this.orderResource.reload();
  }

  /** A change to the records: everything shown is read again after it, and after a conflict. */
  act(request: (admissionId: string) => Observable<unknown>): Observable<void> {
    this.pending.set(true);
    return request(this.admissionId()).pipe(
      map(() => undefined),
      tap({
        next: () => this.reload(),
        error: (error: unknown) => {
          if (toApiError(error).status === 409) this.reload();
        },
      }),
      finalize(() => this.pending.set(false)),
    );
  }
}

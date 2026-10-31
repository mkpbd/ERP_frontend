import { computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { toApiError } from '../../../core/http/api-error';
import type { Page } from '../../../shared/models/page';
import type { AdmissionQuery, AdmissionStatus, AdmissionSummary } from '../models/ipd.models';
import { IpdApi } from '../services/ipd-api.service';

/** The admissions list: those in by default; search by name, UHID or admission number. */
@Injectable()
export class AdmissionsStore {
  private readonly api = inject(IpdApi);

  readonly query = signal<AdmissionQuery>({ page: 1, pageSize: 20, status: 'admitted' });

  private readonly resource = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.admissions(params),
  });
  private readonly lastPage = linkedSignal<
    Page<AdmissionSummary> | undefined,
    Page<AdmissionSummary> | undefined
  >({
    source: () => (this.resource.hasValue() ? this.resource.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  readonly items = computed(() => this.lastPage()?.items ?? []);
  readonly total = computed(() => this.lastPage()?.total ?? 0);
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => {
    const error = this.resource.error();
    return error ? toApiError(error) : null;
  });
  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.items().length === 0);

  setSearch(q: string): void {
    const value = q.trim() || undefined;
    if (value === this.query().q) return;
    this.query.update((query) => ({ ...query, q: value, page: 1 }));
  }

  setStatus(status: AdmissionStatus | undefined): void {
    this.query.update((query) => ({ ...query, status, page: 1 }));
  }

  setPage(pageIndex: number, pageSize: number): void {
    const page = pageSize === this.query().pageSize ? pageIndex + 1 : 1;
    this.query.update((query) => ({ ...query, page, pageSize }));
  }

  reload(): void {
    this.resource.reload();
  }
}

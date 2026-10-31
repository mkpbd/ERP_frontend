import { computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { toApiError } from '../../../core/http/api-error';
import type { Page } from '../../../shared/models/page';
import type { OtCaseQuery, OtCaseStatus, OtCaseSummary } from '../models/ot.models';
import { OtApi } from '../services/ot-api.service';

export const DEFAULT_OT_QUERY: OtCaseQuery = { page: 1, pageSize: 20 };

/** State of the operations list. The query is the single source of truth; each change refetches. */
@Injectable()
export class OtCasesStore {
  private readonly api = inject(OtApi);

  readonly query = signal<OtCaseQuery>(DEFAULT_OT_QUERY);

  private readonly resource = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.list(params),
  });

  /** Last page received, kept while the next one loads. */
  private readonly lastPage = linkedSignal<Page<OtCaseSummary> | undefined, Page<OtCaseSummary> | undefined>({
    source: () => (this.resource.hasValue() ? this.resource.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  readonly cases = computed(() => this.lastPage()?.items ?? []);
  readonly total = computed(() => this.lastPage()?.total ?? 0);
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => {
    const error = this.resource.error();
    return error ? toApiError(error) : null;
  });
  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.cases().length === 0);
  readonly hasFilters = computed(() => {
    const { status, from, to, roomId } = this.query();
    return !!(status || from || to || roomId);
  });

  setStatus(status: OtCaseStatus | undefined): void {
    this.query.update((query) => ({ ...query, status, page: 1 }));
  }

  setPeriod(from: string | undefined, to: string | undefined): void {
    this.query.update((query) => ({ ...query, from, to, page: 1 }));
  }

  setRoom(roomId: string | undefined): void {
    this.query.update((query) => ({ ...query, roomId, page: 1 }));
  }

  setPage(pageIndex: number, pageSize: number): void {
    // MatPaginator is 0-based, the API is 1-based. Changing the page size restarts at the first page.
    const page = pageSize === this.query().pageSize ? pageIndex + 1 : 1;
    this.query.update((query) => ({ ...query, page, pageSize }));
  }

  clearFilters(): void {
    this.query.set({ ...DEFAULT_OT_QUERY, pageSize: this.query().pageSize });
  }

  reload(): void {
    this.resource.reload();
  }
}

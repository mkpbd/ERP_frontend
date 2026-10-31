import { computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import type { Page } from '../../../shared/models/page';
import type {
  ResultQuery,
  ResultStatus,
  ResultSummary,
  SampleQuery,
  SampleSummary,
} from '../models/lab.models';
import { LabApi } from '../services/lab-api.service';

interface ListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: string;
  readonly from?: string;
  readonly to?: string;
}

/**
 * A paged lab list (the worklist, the samples): the query is the single source of truth, each change refetches and
 * the last page stays shown while the next one loads.
 */
abstract class PagedList<TQuery extends ListQuery, TItem> {
  readonly query = signal<TQuery>(this.initial());

  private readonly resource = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.load(params),
  });
  private readonly lastPage = linkedSignal<Page<TItem> | undefined, Page<TItem> | undefined>({
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

  protected abstract initial(): TQuery;
  protected abstract load(query: TQuery): Observable<Page<TItem>>;

  setStatus(status: TQuery['status']): void {
    this.query.update((query) => ({ ...query, status, page: 1 }));
  }

  setPeriod(from: string | undefined, to: string | undefined): void {
    this.query.update((query) => ({ ...query, from, to, page: 1 }));
  }

  setPage(pageIndex: number, pageSize: number): void {
    // MatPaginator is 0-based, the API is 1-based. Changing the page size restarts at the first page.
    const page = pageSize === this.query().pageSize ? pageIndex + 1 : 1;
    this.query.update((query) => ({ ...query, page, pageSize }));
  }

  reload(): void {
    this.resource.reload();
  }
}

/** The worklist: results by status, those to enter first. */
@Injectable()
export class LabWorklistStore extends PagedList<ResultQuery, ResultSummary> {
  private readonly api = inject(LabApi);

  protected initial(): ResultQuery {
    return { page: 1, pageSize: 20, status: 'pending' as ResultStatus };
  }

  protected load(query: ResultQuery) {
    return this.api.results(query);
  }
}

/** The samples, newest first. */
@Injectable()
export class LabSamplesStore extends PagedList<SampleQuery, SampleSummary> {
  private readonly api = inject(LabApi);

  protected initial(): SampleQuery {
    return { page: 1, pageSize: 20 };
  }

  protected load(query: SampleQuery) {
    return this.api.samples(query);
  }
}

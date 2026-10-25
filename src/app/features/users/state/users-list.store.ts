import { computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { toApiError } from '../../../core/http/api-error';
import type { Page, SortOrder } from '../../../shared/models/page';
import type { User, UserListQuery, UserSortField, UserStatus } from '../models/user.models';
import { UsersApi } from '../services/users-api.service';

export const DEFAULT_USER_QUERY: UserListQuery = { page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' };

/**
 * State of the users list page. Provided by the page component, so it is created and destroyed with it.
 * The query is the single source of truth; `rxResource` refetches whenever it changes and cancels the
 * previous request, so fast typing or paging never shows stale results.
 */
@Injectable()
export class UsersListStore {
  private readonly api = inject(UsersApi);

  readonly query = signal<UserListQuery>(DEFAULT_USER_QUERY);

  private readonly resource = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.list(params),
  });

  /** Last page received. Kept while the next one loads, so the table does not flash empty between pages. */
  private readonly lastPage = linkedSignal<Page<User> | undefined, Page<User> | undefined>({
    source: () => (this.resource.hasValue() ? this.resource.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  readonly users = computed(() => this.lastPage()?.items ?? []);
  readonly total = computed(() => this.lastPage()?.total ?? 0);
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => {
    const error = this.resource.error();
    return error ? toApiError(error) : null;
  });
  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.users().length === 0);
  readonly hasFilters = computed(() => !!this.query().search || !!this.query().status);

  setSearch(search: string): void {
    const value = search.trim() || undefined;
    if (value === this.query().search) return;
    this.query.update((query) => ({ ...query, search: value, page: 1 }));
  }

  setStatus(status: UserStatus | undefined): void {
    this.query.update((query) => ({ ...query, status, page: 1 }));
  }

  setPage(pageIndex: number, pageSize: number): void {
    // MatPaginator is 0-based, the API is 1-based. Changing the page size restarts at the first page.
    const page = pageSize === this.query().pageSize ? pageIndex + 1 : 1;
    this.query.update((query) => ({ ...query, page, pageSize }));
  }

  setSort(sort: UserSortField, order: SortOrder | ''): void {
    this.query.update((query) =>
      order
        ? { ...query, sort, order, page: 1 }
        : { ...query, sort: DEFAULT_USER_QUERY.sort, order: DEFAULT_USER_QUERY.order },
    );
  }

  clearFilters(): void {
    this.query.update((query) => ({ ...query, search: undefined, status: undefined, page: 1 }));
  }

  reload(): void {
    this.resource.reload();
  }
}

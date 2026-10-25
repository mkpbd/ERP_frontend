import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import type { Page } from '../../../shared/models/page';
import type { User, UserListQuery } from '../models/user.models';
import { UsersApi } from '../services/users-api.service';
import { DEFAULT_USER_QUERY, UsersListStore } from './users-list.store';

const user = (id: string): User => ({
  id,
  email: `${id}@example.com`,
  username: null,
  displayName: id,
  status: 'active',
  emailVerified: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const page = (items: User[], total = items.length): Page<User> => ({
  items,
  total,
  page: 1,
  pageSize: 20,
  totalPages: Math.ceil(total / 20),
});

/** Resolves once pending resources have settled. */
const stable = () => TestBed.inject(ApplicationRef).whenStable();

describe('UsersListStore', () => {
  function setup(list: (query: UserListQuery) => ReturnType<UsersApi['list']>) {
    const api = { list: vi.fn(list) };
    TestBed.configureTestingModule({ providers: [UsersListStore, { provide: UsersApi, useValue: api }] });
    return { store: TestBed.inject(UsersListStore), api };
  }

  it('loads the first page with the default query', async () => {
    const { store, api } = setup(() => of(page([user('a'), user('b')], 42)));
    await stable();
    expect(api.list).toHaveBeenCalledWith(DEFAULT_USER_QUERY);
    expect(store.users().map((u) => u.id)).toEqual(['a', 'b']);
    expect(store.total()).toBe(42);
    expect(store.isEmpty()).toBe(false);
  });

  it('resets to page 1 when the search, status or page size changes', async () => {
    const { store, api } = setup(() => of(page([])));
    store.setPage(3, 20);
    expect(store.query().page).toBe(4);
    store.setSearch('  jane ');
    expect(store.query()).toMatchObject({ search: 'jane', page: 1 });
    store.setPage(2, 20);
    store.setStatus('deactivated');
    expect(store.query()).toMatchObject({ status: 'deactivated', page: 1 });
    store.setPage(5, 50);
    expect(store.query()).toMatchObject({ page: 1, pageSize: 50 });
    await stable();
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageSize: 50, status: 'deactivated', search: 'jane' }),
    );
  });

  it('keeps the previous rows visible while the next page loads', async () => {
    const pending = new Subject<Page<User>>();
    let call = 0;
    const { store } = setup(() => (call++ === 0 ? of(page([user('a')])) : pending));
    await stable();
    // The page template reads the rows on every render; the linked signal tracks "previous" from those reads.
    expect(store.users().map((u) => u.id)).toEqual(['a']);
    store.setPage(1, 20);
    TestBed.tick();
    expect(store.loading()).toBe(true);
    expect(store.users().map((u) => u.id)).toEqual(['a']);
    pending.next(page([user('b')]));
    pending.complete();
    await stable();
    expect(store.users().map((u) => u.id)).toEqual(['b']);
  });

  it('exposes errors as ApiError and reports empty results', async () => {
    const { store } = setup(() => throwError(() => new ApiError(500, 'internal', 'boom')));
    await stable();
    expect(store.error()?.code).toBe('internal');
    expect(store.isEmpty()).toBe(false);
  });

  it('reports filtered empty results', async () => {
    const { store } = setup(() => of(page([])));
    store.setSearch('nobody');
    await stable();
    expect(store.isEmpty()).toBe(true);
    expect(store.hasFilters()).toBe(true);
  });
});

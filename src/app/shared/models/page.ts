/** Offset pagination envelope used by every backend list endpoint. `page` is 1-based. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export type SortOrder = 'asc' | 'desc';

export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

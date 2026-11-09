import { totalPages, type PagedResult } from '../kernel/paged-result';

/** 02-SRS §7.3 standard list envelope. */
export interface ListEnvelope<T> {
  data: T[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}

export function listEnvelope<T, U>(result: PagedResult<T>, map: (item: T) => U): ListEnvelope<U> {
  return {
    data: result.items.map(map),
    pagination: {
      page: result.page,
      page_size: result.pageSize,
      total: result.total,
      total_pages: totalPages(result.total, result.pageSize),
    },
  };
}

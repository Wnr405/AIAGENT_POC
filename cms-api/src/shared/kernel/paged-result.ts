import { ValidationError } from './errors';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** FR-CONTENT-10 / FR-PUBAPI-05: default 25, max 100, 1-based pages. */
export function pageRequest(page?: number, pageSize?: number): PageRequest {
  const p = page ?? 1;
  const s = pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(p) || p < 1) {
    throw new ValidationError('page must be a positive integer', { field: 'page' });
  }
  if (!Number.isInteger(s) || s < 1 || s > MAX_PAGE_SIZE) {
    throw new ValidationError(`page_size must be between 1 and ${MAX_PAGE_SIZE}`, {
      field: 'page_size',
    });
  }
  return { page: p, pageSize: s };
}

export function totalPages(total: number, pageSize: number): number {
  return total === 0 ? 0 : Math.ceil(total / pageSize);
}

export function paginate<T>(all: readonly T[], req: PageRequest): PagedResult<T> {
  const start = (req.page - 1) * req.pageSize;
  return {
    items: all.slice(start, start + req.pageSize),
    total: all.length,
    page: req.page,
    pageSize: req.pageSize,
  };
}

export function mapPaged<T, U>(result: PagedResult<T>, fn: (item: T) => U): PagedResult<U> {
  return { ...result, items: result.items.map(fn) };
}

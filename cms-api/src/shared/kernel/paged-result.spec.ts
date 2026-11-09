import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors';
import { DEFAULT_PAGE_SIZE, mapPaged, MAX_PAGE_SIZE, pageRequest, paginate, totalPages } from './paged-result';

describe('pageRequest (FR-CONTENT-10, FR-PUBAPI-05)', () => {
  it('defaults to page 1 of 25', () => {
    expect(pageRequest()).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('accepts the maximum page size of 100', () => {
    expect(pageRequest(3, MAX_PAGE_SIZE)).toEqual({ page: 3, pageSize: 100 });
  });

  it.each([[0], [-1], [1.5]])('rejects page %s', (page: number) => {
    expect(() => pageRequest(page, 10)).toThrow(ValidationError);
  });

  it.each([[0], [101], [2.5]])('rejects page_size %s', (size: number) => {
    expect(() => pageRequest(1, size)).toThrow(/page_size/);
  });
});

describe('paginate / totalPages / mapPaged', () => {
  it('slices the requested page and reports the total', () => {
    const r = paginate([1, 2, 3, 4, 5], { page: 2, pageSize: 2 });
    expect(r).toEqual({ items: [3, 4], total: 5, page: 2, pageSize: 2 });
  });

  it('computes total pages, zero for empty results', () => {
    expect(totalPages(0, 25)).toBe(0);
    expect(totalPages(137, 25)).toBe(6);
    expect(totalPages(25, 25)).toBe(1);
  });

  it('maps items and keeps paging metadata', () => {
    expect(mapPaged({ items: [1, 2], total: 2, page: 1, pageSize: 25 }, (n) => n * 10)).toEqual({
      items: [10, 20],
      total: 2,
      page: 1,
      pageSize: 25,
    });
  });
});

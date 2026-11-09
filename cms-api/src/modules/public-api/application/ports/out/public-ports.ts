import type { PageRequest, PagedResult } from '../../../../../shared/kernel/paged-result';
import type { PublicMediaRef, PublishedItem } from '../../../domain/published-content';

export interface PublishedListCriteria {
  readonly tag?: string;
  readonly category?: string;
}

/** MUST filter status = published AND published_at ≤ now AND deleted_at IS NULL (RK-04). */
export interface PublishedContentReader {
  list(
    type: 'article' | 'page',
    criteria: PublishedListCriteria,
    page: PageRequest,
    now: Date,
  ): Promise<PagedResult<PublishedItem>>;
  getBySlug(type: 'article' | 'page', slug: string, now: Date): Promise<PublishedItem | null>;
}

export interface PublicMediaReader {
  get(id: string): Promise<PublicMediaRef | null>;
}

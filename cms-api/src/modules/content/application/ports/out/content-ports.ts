import type { PageRequest, PagedResult } from '../../../../../shared/kernel/paged-result';
import type { Content } from '../../../domain/entities/content.entity';
import type { ContentVersion } from '../../../domain/entities/content-version.entity';
import type { ContentStatus } from '../../../domain/value-objects/content-status';
import type { ContentType } from '../../../domain/value-objects/content-type';

export type ContentSortField = 'updatedAt' | 'title' | 'status' | 'createdAt';

export interface ContentSearchCriteria {
  readonly type?: ContentType;
  readonly status?: ContentStatus;
  readonly authorId?: string;
  readonly tag?: string;
  readonly search?: string; // FR-CONTENT-11: title, case-insensitive partial
  readonly updatedFrom?: Date;
  readonly updatedTo?: Date;
  readonly sort?: ContentSortField;
  readonly order?: 'asc' | 'desc';
}

/** Data access for the content aggregate. Soft-deleted rows are excluded from `findMany`. */
export interface ContentRepository {
  save(content: Content): Promise<void>;
  findById(id: string): Promise<Content | null>;
  /** Includes soft-deleted rows: their slugs stay reserved until purge. */
  findBySlug(type: ContentType, slug: string): Promise<Content | null>;
  findMany(criteria: ContentSearchCriteria, page: PageRequest): Promise<PagedResult<Content>>;
  findDueForPublish(now: Date, limit: number): Promise<Content[]>;
  findDeletedBefore(cutoff: Date, limit: number): Promise<Content[]>;
  hardDelete(id: string): Promise<void>;
  countByStatus(authorId?: string): Promise<Record<ContentStatus, number> & { scheduled: number }>;
  /** FR-MEDIA-07: is the media referenced by any non-deleted content? */
  isMediaReferenced(mediaId: string): Promise<boolean>;
  /**
   * Public visibility filter enforced AT THE REPOSITORY LAYER (RK-04):
   * status = published AND published_at <= now AND deleted_at IS NULL.
   */
  findPublished(
    type: ContentType,
    filter: { tag?: string; category?: string },
    page: PageRequest,
    now: Date,
  ): Promise<PagedResult<Content>>;
  findPublishedBySlug(type: ContentType, slug: string, now: Date): Promise<Content | null>;
}

export interface ContentVersionRepository {
  append(version: ContentVersion): Promise<void>;
  list(contentId: string): Promise<ContentVersion[]>; // newest first
  find(contentId: string, versionNo: number): Promise<ContentVersion | null>;
  latestVersionNo(contentId: string): Promise<number>; // 0 when none
  prune(contentId: string, keep: number): Promise<void>;
  deleteAll(contentId: string): Promise<void>;
}

/** Cross-module lookups, implemented in the composition root. */
export interface UserDirectory {
  namesByIds(ids: readonly string[]): Promise<Map<string, string>>;
}
export interface MediaLookup {
  existingIds(ids: readonly string[]): Promise<Set<string>>;
}

export interface ContentSettings {
  /** Predefined article categories (§6.2). */
  readonly categories: readonly string[];
  /** FR-CONTENT-13: soft-deleted content is hard-deleted after this many days. */
  readonly softDeleteRetentionDays: number;
}

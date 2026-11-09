import type { ActorContext, AnyActor } from '../../../../../shared/kernel/actor';
import type { PagedResult } from '../../../../../shared/kernel/paged-result';
import type { ContentSnapshot } from '../../../domain/entities/content.entity';
import type { RtNode } from '../../../domain/value-objects/rich-text-body.vo';
import type { ContentStatus } from '../../../domain/value-objects/content-status';
import type { ContentType } from '../../../domain/value-objects/content-type';
import type { ContentSortField } from '../out/content-ports';

export interface ContentView {
  readonly id: string;
  readonly type: ContentType;
  readonly title: string;
  readonly slug: string;
  readonly body: RtNode;
  readonly status: ContentStatus;
  readonly author: { id: string; name: string | null };
  readonly featuredImageId: string | null;
  readonly socialImageId: string | null;
  readonly seo: { title: string | null; description: string | null };
  readonly effectiveSeo: { title: string; description: string };
  readonly tags: string[];
  readonly category: string | null;
  readonly parentId: string | null;
  readonly scheduledAt: Date | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type ContentSummaryView = Omit<ContentView, 'body'>;

export interface ContentFields {
  readonly title?: string;
  readonly slug?: string;
  readonly body?: unknown; // untrusted rich text JSON, sanitised by the domain
  readonly seoTitle?: string | null;
  readonly seoDescription?: string | null;
  readonly tags?: string[];
  readonly category?: string | null;
  readonly parentId?: string | null;
  readonly featuredImageId?: string | null;
  readonly socialImageId?: string | null;
}

export interface CreateContentCommand extends ContentFields {
  readonly type: ContentType;
  readonly title: string;
}

export interface ListContentQuery {
  readonly type?: ContentType;
  readonly status?: ContentStatus;
  readonly authorId?: string;
  readonly tag?: string;
  readonly search?: string;
  readonly updatedFrom?: Date;
  readonly updatedTo?: Date;
  readonly sort?: ContentSortField;
  readonly order?: 'asc' | 'desc';
  readonly page?: number;
  readonly pageSize?: number;
}

export interface VersionView {
  readonly versionNo: number;
  readonly editor: { id: string | null; name: string | null };
  readonly createdAt: Date;
  readonly snapshot: ContentSnapshot;
}

export type ContentStats = Record<ContentStatus, number> & { scheduled: number; total: number };

export type TransitionAction = 'submit' | 'reject' | 'publish' | 'unpublish' | 'archive';

export interface ContentUseCases {
  create(cmd: CreateContentCommand, actor: ActorContext): Promise<ContentView>;
  update(id: string, patch: ContentFields, actor: ActorContext): Promise<ContentView>;
  get(id: string, actor: ActorContext): Promise<ContentView>;
  list(query: ListContentQuery, actor: ActorContext): Promise<PagedResult<ContentSummaryView>>;
  transition(id: string, action: TransitionAction, actor: ActorContext): Promise<ContentView>;
  schedule(id: string, at: Date | null, actor: ActorContext): Promise<ContentView>;
  delete(id: string, actor: ActorContext): Promise<void>;
  listVersions(id: string, actor: ActorContext): Promise<VersionView[]>;
  revert(id: string, versionNo: number, actor: ActorContext): Promise<ContentView>;
  stats(actor: ActorContext): Promise<ContentStats>;
}

export interface ContentJobs {
  /** FR-CONTENT-07: returns number of items published. */
  publishDue(actor: AnyActor): Promise<number>;
  /** FR-CONTENT-13: returns number of items hard-deleted. */
  purgeDeleted(actor: AnyActor): Promise<number>;
}

export interface ContentMediaUsageQuery {
  isMediaReferenced(mediaId: string): Promise<boolean>;
}

/** Projection consumed by the public-api module (via the composition root). */
export interface PublishedContentProjection {
  readonly id: string;
  readonly type: ContentType;
  readonly status: ContentStatus;
  readonly title: string;
  readonly slug: string;
  readonly body: RtNode;
  readonly authorId: string;
  readonly featuredImageId: string | null;
  readonly socialImageId: string | null;
  readonly seo: { title: string; description: string };
  readonly tags: readonly string[];
  readonly category: string | null;
  readonly parentId: string | null;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface PublishedContentQuery {
  list(
    type: ContentType,
    filter: { tag?: string; category?: string },
    page: { page: number; pageSize: number },
    now: Date,
  ): Promise<PagedResult<PublishedContentProjection>>;
  bySlug(type: ContentType, slug: string, now: Date): Promise<PublishedContentProjection | null>;
}

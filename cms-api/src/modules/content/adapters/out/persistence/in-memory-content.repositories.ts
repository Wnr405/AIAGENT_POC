import { paginate, type PageRequest, type PagedResult } from '../../../../../shared/kernel/paged-result';
import { containsCI, type MemoryDb } from '../../../../../shared/adapters/memory/memory-db';
import { Content, type ContentProps } from '../../../domain/entities/content.entity';
import type { ContentVersion } from '../../../domain/entities/content-version.entity';
import { CONTENT_STATUSES, type ContentStatus } from '../../../domain/value-objects/content-status';
import type { ContentType } from '../../../domain/value-objects/content-type';
import type {
  ContentRepository,
  ContentSearchCriteria,
  ContentVersionRepository,
} from '../../../application/ports/out/content-ports';

const isPublic = (p: ContentProps, now: Date): boolean =>
  p.status === 'published' && p.deletedAt === null && p.publishedAt !== null && p.publishedAt <= now;

export class InMemoryContentRepository implements ContentRepository {
  constructor(private readonly db: MemoryDb) {}

  private get t(): Map<string, ContentProps> {
    return this.db.table<ContentProps>('contents');
  }
  private all(): ContentProps[] {
    return [...this.t.values()];
  }
  private hydrate = (p: ContentProps): Content => Content.rehydrate(p);

  save(content: Content): Promise<void> {
    this.t.set(content.id, content.toProps());
    return Promise.resolve();
  }

  findById(id: string): Promise<Content | null> {
    const p = this.t.get(id);
    return Promise.resolve(p ? this.hydrate(p) : null);
  }

  findBySlug(type: ContentType, slug: string): Promise<Content | null> {
    const p = this.all().find((c) => c.type === type && c.slug.value === slug);
    return Promise.resolve(p ? this.hydrate(p) : null);
  }

  findMany(c: ContentSearchCriteria, page: PageRequest): Promise<PagedResult<Content>> {
    const sort = c.sort ?? 'updatedAt';
    const dir = (c.order ?? (sort === 'title' ? 'asc' : 'desc')) === 'asc' ? 1 : -1;
    const key = (p: ContentProps): string | number =>
      sort === 'title' ? p.title.toLowerCase() : sort === 'status' ? p.status : p[sort].getTime();
    const rows = this.all()
      .filter((p) => p.deletedAt === null)
      .filter((p) => !c.type || p.type === c.type)
      .filter((p) => !c.status || p.status === c.status)
      .filter((p) => !c.authorId || p.authorId === c.authorId)
      .filter((p) => !c.tag || p.tags.includes(c.tag.toLowerCase()))
      .filter((p) => !c.search || containsCI(p.title, c.search))
      .filter((p) => !c.updatedFrom || p.updatedAt >= c.updatedFrom)
      .filter((p) => !c.updatedTo || p.updatedAt <= c.updatedTo)
      .sort((a, b) => (key(a) < key(b) ? -dir : key(a) > key(b) ? dir : 0));
    return Promise.resolve(paginate(rows.map(this.hydrate), page));
  }

  findDueForPublish(now: Date, limit: number): Promise<Content[]> {
    const rows = this.all().filter(
      (p) =>
        p.deletedAt === null &&
        p.scheduledAt !== null &&
        p.scheduledAt <= now &&
        (p.status === 'draft' || p.status === 'in_review'),
    );
    return Promise.resolve(rows.slice(0, limit).map(this.hydrate));
  }

  findDeletedBefore(cutoff: Date, limit: number): Promise<Content[]> {
    const rows = this.all().filter((p) => p.deletedAt !== null && p.deletedAt < cutoff);
    return Promise.resolve(rows.slice(0, limit).map(this.hydrate));
  }

  hardDelete(id: string): Promise<void> {
    this.t.delete(id);
    return Promise.resolve();
  }

  countByStatus(authorId?: string): Promise<Record<ContentStatus, number> & { scheduled: number }> {
    const counts = Object.fromEntries(CONTENT_STATUSES.map((s) => [s, 0])) as Record<ContentStatus, number>;
    let scheduled = 0;
    for (const p of this.all()) {
      if (p.deletedAt !== null || (authorId && p.authorId !== authorId)) continue;
      counts[p.status] += 1;
      if (p.scheduledAt !== null) scheduled += 1;
    }
    return Promise.resolve({ ...counts, scheduled });
  }

  isMediaReferenced(mediaId: string): Promise<boolean> {
    return Promise.resolve(
      this.all().some((p) => p.deletedAt === null && this.hydrate(p).referencedMediaIds().includes(mediaId)),
    );
  }

  findPublished(
    type: ContentType,
    filter: { tag?: string; category?: string },
    page: PageRequest,
    now: Date,
  ): Promise<PagedResult<Content>> {
    const rows = this.all()
      .filter((p) => p.type === type && isPublic(p, now))
      .filter((p) => !filter.tag || p.tags.includes(filter.tag.toLowerCase()))
      .filter((p) => !filter.category || p.category === filter.category)
      .sort((a, b) => (b.publishedAt as Date).getTime() - (a.publishedAt as Date).getTime());
    return Promise.resolve(paginate(rows.map(this.hydrate), page));
  }

  findPublishedBySlug(type: ContentType, slug: string, now: Date): Promise<Content | null> {
    const p = this.all().find((c) => c.type === type && c.slug.value === slug && isPublic(c, now));
    return Promise.resolve(p ? this.hydrate(p) : null);
  }
}

export class InMemoryContentVersionRepository implements ContentVersionRepository {
  constructor(private readonly db: MemoryDb) {}

  private get t(): Map<string, ContentVersion> {
    return this.db.table<ContentVersion>('content_versions');
  }
  private forContent(contentId: string): ContentVersion[] {
    return [...this.t.values()].filter((v) => v.contentId === contentId).sort((a, b) => b.versionNo - a.versionNo);
  }

  append(version: ContentVersion): Promise<void> {
    this.t.set(version.id, structuredClone(version));
    return Promise.resolve();
  }

  list(contentId: string): Promise<ContentVersion[]> {
    return Promise.resolve(this.forContent(contentId));
  }

  find(contentId: string, versionNo: number): Promise<ContentVersion | null> {
    return Promise.resolve(this.forContent(contentId).find((v) => v.versionNo === versionNo) ?? null);
  }

  latestVersionNo(contentId: string): Promise<number> {
    return Promise.resolve(this.forContent(contentId)[0]?.versionNo ?? 0);
  }

  prune(contentId: string, keep: number): Promise<void> {
    for (const v of this.forContent(contentId).slice(keep)) this.t.delete(v.id);
    return Promise.resolve();
  }

  deleteAll(contentId: string): Promise<void> {
    for (const v of this.forContent(contentId)) this.t.delete(v.id);
    return Promise.resolve();
  }
}

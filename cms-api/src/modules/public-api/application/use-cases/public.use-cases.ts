import { NotFoundError } from '../../../../shared/kernel/errors';
import { pageRequest, type PagedResult } from '../../../../shared/kernel/paged-result';
import type { DomainEvent } from '../../../../shared/kernel/domain-event';
import type { Cache } from '../../../../shared/ports/cache.port';
import type { Clock } from '../../../../shared/ports/clock.port';
import { isPubliclyVisible, type PublicMediaRef, type PublishedItem } from '../../domain/published-content';
import type { PublicMediaReader, PublishedContentReader, PublishedListCriteria } from '../ports/out/public-ports';

/** FR-CONTENT-12: TTL well under 60 s so unpublish propagates even if invalidation is missed. */
export const PUBLIC_CACHE_TTL_SECONDS = 30;
const GENERATION_KEY = 'pub:generation';

export interface PublicDeps {
  readonly reader: PublishedContentReader;
  readonly media: PublicMediaReader;
  readonly cache: Cache;
  readonly clock: Clock;
}

async function generation(cache: Cache): Promise<number> {
  return (await cache.get<number>(GENERATION_KEY)) ?? 0;
}

/** Visibility re-check on every item (defence in depth over the repository filter). */
function visibleOnly(items: readonly PublishedItem[], now: Date): PublishedItem[] {
  return items.filter((i) => isPubliclyVisible(i, now));
}

/** UR-D01, FR-PUBAPI-03/05 */
export class ListPublishedContent {
  constructor(private readonly d: PublicDeps) {}

  async execute(
    type: 'article' | 'page',
    q: PublishedListCriteria & { page?: number; pageSize?: number },
  ): Promise<PagedResult<PublishedItem>> {
    const page = pageRequest(q.page, q.pageSize);
    const key = `pub:${await generation(this.d.cache)}:${type}:list:${page.page}:${page.pageSize}:${q.tag ?? ''}:${q.category ?? ''}`;
    const cached = await this.d.cache.get<PagedResult<PublishedItem>>(key);
    const now = this.d.clock.now();
    if (cached) return { ...cached, items: visibleOnly(revive(cached.items), now) };
    const result = await this.d.reader.list(type, { tag: q.tag, category: q.category }, page, now);
    const safe = { ...result, items: visibleOnly(result.items, now) };
    await this.d.cache.set(key, safe, PUBLIC_CACHE_TTL_SECONDS);
    return safe;
  }
}

/** UR-D02, FR-SEO-03 */
export class GetPublishedContentBySlug {
  constructor(private readonly d: PublicDeps) {}

  async execute(type: 'article' | 'page', slug: string): Promise<PublishedItem> {
    const key = `pub:${await generation(this.d.cache)}:${type}:slug:${slug}`;
    const now = this.d.clock.now();
    const cached = await this.d.cache.get<PublishedItem>(key);
    const item = cached ? revive([cached])[0] : await this.d.reader.getBySlug(type, slug, now);
    if (!item || !isPubliclyVisible(item, now)) throw new NotFoundError(type === 'article' ? 'Article' : 'Page');
    if (!cached) await this.d.cache.set(key, item, PUBLIC_CACHE_TTL_SECONDS);
    return item;
  }
}

export class GetPublicMedia {
  constructor(private readonly d: Pick<PublicDeps, 'media'>) {}

  async execute(id: string): Promise<PublicMediaRef> {
    const media = await this.d.media.get(id);
    if (!media) throw new NotFoundError('Media', id);
    return media;
  }
}

/** Content events bump the cache generation so stale lists vanish immediately. */
export class InvalidatePublicCache {
  constructor(private readonly d: Pick<PublicDeps, 'cache'>) {}

  async execute(event: DomainEvent): Promise<void> {
    if (event.target.type !== 'content' && event.target.type !== 'media') return;
    await this.d.cache.increment(GENERATION_KEY, 7 * 24 * 3600);
  }
}

/** JSON caches (Redis) turn Dates into strings; restore the ones we compare against. */
function revive(items: readonly PublishedItem[]): PublishedItem[] {
  const d = (v: Date | string | null): Date | null => (v === null ? null : new Date(v));
  return items.map((i) => ({
    ...i,
    publishedAt: d(i.publishedAt),
    updatedAt: d(i.updatedAt) as Date,
    deletedAt: d(i.deletedAt),
  }));
}

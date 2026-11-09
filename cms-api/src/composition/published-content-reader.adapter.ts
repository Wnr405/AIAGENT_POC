import type { PublishedContentQuery } from '../modules/content/application/ports/in/content.ports';
import type { MediaPublicQuery } from '../modules/media/application/use-cases/media.use-cases';
import type { PublicMediaRef, PublishedItem } from '../modules/public-api/domain/published-content';
import type {
  PublicMediaReader,
  PublishedContentReader,
  PublishedListCriteria,
} from '../modules/public-api/application/ports/out/public-ports';
import type { UserRepository } from '../modules/users/application/ports/out/user-repository.port';
import type { PageRequest, PagedResult } from '../shared/kernel/paged-result';
import type { PublishedContentProjection } from '../modules/content/application/ports/in/content.ports';

/**
 * Cross-module adapter (composition root only): implements the public-api
 * module's outbound ports using the content / media / users inbound ports.
 */
export class PublishedContentReaderAdapter implements PublishedContentReader, PublicMediaReader {
  constructor(
    private readonly content: PublishedContentQuery,
    private readonly media: MediaPublicQuery,
    private readonly users: Pick<UserRepository, 'namesByIds'>,
  ) {}

  get(id: string): Promise<PublicMediaRef | null> {
    return this.media.get(id);
  }

  private async enrich(items: readonly PublishedContentProjection[]): Promise<PublishedItem[]> {
    const names = await this.users.namesByIds([...new Set(items.map((i) => i.authorId))]);
    const mediaIds = [...new Set(items.flatMap((i) => [i.featuredImageId, i.socialImageId]))].filter(
      (x): x is string => x !== null,
    );
    const media = new Map<string, PublicMediaRef>();
    for (const id of mediaIds) {
      const ref = await this.media.get(id);
      if (ref) media.set(id, ref);
    }
    return items.map((i) => ({
      id: i.id,
      type: i.type,
      status: i.status,
      title: i.title,
      slug: i.slug,
      body: i.body,
      // Pages have no author display (§6.2).
      author: i.type === 'article' ? { name: names.get(i.authorId) ?? 'Unknown' } : null,
      featuredImage: i.featuredImageId ? (media.get(i.featuredImageId) ?? null) : null,
      socialImage: i.socialImageId ? (media.get(i.socialImageId) ?? null) : null,
      seo: i.seo,
      tags: i.tags,
      category: i.category,
      parentId: i.parentId,
      publishedAt: i.publishedAt,
      updatedAt: i.updatedAt,
      deletedAt: i.deletedAt,
    }));
  }

  async list(
    type: 'article' | 'page',
    criteria: PublishedListCriteria,
    page: PageRequest,
    now: Date,
  ): Promise<PagedResult<PublishedItem>> {
    const result = await this.content.list(type, criteria, page, now);
    return { ...result, items: await this.enrich(result.items) };
  }

  async getBySlug(type: 'article' | 'page', slug: string, now: Date): Promise<PublishedItem | null> {
    const item = await this.content.bySlug(type, slug, now);
    if (!item) return null;
    const [enriched] = await this.enrich([item]); // enrich maps 1:1
    return enriched as PublishedItem;
  }
}

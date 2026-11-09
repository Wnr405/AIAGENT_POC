import type { Content as ContentRow, Prisma } from '@prisma/client';
import type { PageRequest, PagedResult } from '../../../../../shared/kernel/paged-result';
import type { PrismaContext } from '../../../../../shared/adapters/prisma/prisma-context';
import { Content } from '../../../domain/entities/content.entity';
import type { ContentSnapshot } from '../../../domain/entities/content.entity';
import type { ContentVersion } from '../../../domain/entities/content-version.entity';
import { CONTENT_STATUSES, type ContentStatus } from '../../../domain/value-objects/content-status';
import type { ContentType } from '../../../domain/value-objects/content-type';
import { RichTextBody, type RtNode } from '../../../domain/value-objects/rich-text-body.vo';
import { SeoMetadata } from '../../../domain/value-objects/seo-metadata.vo';
import { Slug } from '../../../domain/value-objects/slug.vo';
import type {
  ContentRepository,
  ContentSearchCriteria,
  ContentVersionRepository,
} from '../../../application/ports/out/content-ports';

export const ContentPersistenceMapper = {
  toDomain(r: ContentRow): Content {
    return Content.rehydrate({
      id: r.id,
      type: r.type,
      title: r.title,
      slug: Slug.create(r.slug),
      body: RichTextBody.fromTrusted(r.body as unknown as RtNode),
      status: r.status,
      authorId: r.authorId,
      featuredImageId: r.featuredImageId,
      socialImageId: r.socialImageId,
      seo: SeoMetadata.create({ title: r.seoTitle, description: r.seoDescription }),
      tags: r.tags,
      category: r.category,
      parentId: r.parentId,
      scheduledAt: r.scheduledAt,
      publishedAt: r.publishedAt,
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  },

  toPersistence(c: Content): Prisma.ContentUncheckedCreateInput {
    const p = c.toProps();
    const effective = c.effectiveSeo();
    return {
      id: p.id,
      type: p.type,
      title: p.title,
      slug: p.slug.value,
      body: p.body.doc as unknown as Prisma.InputJsonValue,
      status: p.status,
      authorId: p.authorId,
      featuredImageId: p.featuredImageId,
      socialImageId: p.socialImageId,
      seoTitle: p.seo.title,
      seoDescription: p.seo.description,
      effectiveSeoTitle: effective.title,
      effectiveSeoDescription: effective.description,
      tags: p.tags,
      category: p.category,
      parentId: p.parentId,
      scheduledAt: p.scheduledAt,
      publishedAt: p.publishedAt,
      deletedAt: p.deletedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  },
};

/** RK-04: the public visibility predicate lives in exactly one query fragment. */
const publiclyVisible = (now: Date): Prisma.ContentWhereInput => ({
  status: 'published',
  deletedAt: null,
  publishedAt: { lte: now },
});

export class PrismaContentRepository implements ContentRepository {
  constructor(private readonly ctx: PrismaContext) {}

  async save(content: Content): Promise<void> {
    const data = ContentPersistenceMapper.toPersistence(content);
    const db = this.ctx.db;
    await db.content.upsert({ where: { id: data.id }, create: data, update: data });
    // Rewrite embedded media references (FR-MEDIA-07). Unknown ids are ignored.
    const inline = content.body.referencedMediaIds();
    await db.contentMediaRef.deleteMany({ where: { contentId: content.id } });
    if (inline.length > 0) {
      const existing = await db.mediaItem.findMany({ where: { id: { in: inline } }, select: { id: true } });
      await db.contentMediaRef.createMany({
        data: existing.map((m) => ({ contentId: content.id, mediaId: m.id })),
        skipDuplicates: true,
      });
    }
  }

  async findById(id: string): Promise<Content | null> {
    const r = await this.ctx.db.content.findUnique({ where: { id } });
    return r ? ContentPersistenceMapper.toDomain(r) : null;
  }

  async findBySlug(type: ContentType, slug: string): Promise<Content | null> {
    const r = await this.ctx.db.content.findUnique({ where: { type_slug: { type, slug } } });
    return r ? ContentPersistenceMapper.toDomain(r) : null;
  }

  async findMany(c: ContentSearchCriteria, page: PageRequest): Promise<PagedResult<Content>> {
    const where: Prisma.ContentWhereInput = {
      deletedAt: null,
      type: c.type,
      status: c.status,
      authorId: c.authorId,
      ...(c.tag ? { tags: { has: c.tag.toLowerCase() } } : {}),
      ...(c.search ? { title: { contains: c.search, mode: 'insensitive' } } : {}),
      ...(c.updatedFrom || c.updatedTo ? { updatedAt: { gte: c.updatedFrom, lte: c.updatedTo } } : {}),
    };
    const sort = c.sort ?? 'updatedAt';
    const order = c.order ?? (sort === 'title' ? 'asc' : 'desc');
    const [rows, total] = await Promise.all([
      this.ctx.db.content.findMany({
        where,
        orderBy: [{ [sort]: order }, { id: 'asc' }],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.ctx.db.content.count({ where }),
    ]);
    return {
      items: rows.map((row) => ContentPersistenceMapper.toDomain(row)),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async findDueForPublish(now: Date, limit: number): Promise<Content[]> {
    const rows = await this.ctx.db.content.findMany({
      where: { deletedAt: null, scheduledAt: { lte: now }, status: { in: ['draft', 'in_review'] } },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => ContentPersistenceMapper.toDomain(row));
  }

  async findDeletedBefore(cutoff: Date, limit: number): Promise<Content[]> {
    const rows = await this.ctx.db.content.findMany({ where: { deletedAt: { lt: cutoff } }, take: limit });
    return rows.map((row) => ContentPersistenceMapper.toDomain(row));
  }

  async hardDelete(id: string): Promise<void> {
    await this.ctx.db.content.updateMany({ where: { parentId: id }, data: { parentId: null } });
    await this.ctx.db.content.delete({ where: { id } });
  }

  async countByStatus(authorId?: string): Promise<Record<ContentStatus, number> & { scheduled: number }> {
    const where: Prisma.ContentWhereInput = { deletedAt: null, authorId };
    const [groups, scheduled] = await Promise.all([
      this.ctx.db.content.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.ctx.db.content.count({ where: { ...where, scheduledAt: { not: null } } }),
    ]);
    const counts = Object.fromEntries(CONTENT_STATUSES.map((s) => [s, 0])) as Record<ContentStatus, number>;
    for (const g of groups) counts[g.status] = g._count._all;
    return { ...counts, scheduled };
  }

  async isMediaReferenced(mediaId: string): Promise<boolean> {
    const n = await this.ctx.db.content.count({
      where: {
        deletedAt: null,
        OR: [{ featuredImageId: mediaId }, { socialImageId: mediaId }, { mediaRefs: { some: { mediaId } } }],
      },
    });
    return n > 0;
  }

  async findPublished(
    type: ContentType,
    filter: { tag?: string; category?: string },
    page: PageRequest,
    now: Date,
  ): Promise<PagedResult<Content>> {
    const where: Prisma.ContentWhereInput = {
      ...publiclyVisible(now),
      type,
      ...(filter.tag ? { tags: { has: filter.tag.toLowerCase() } } : {}),
      ...(filter.category ? { category: filter.category } : {}),
    };
    const [rows, total] = await Promise.all([
      this.ctx.db.content.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.ctx.db.content.count({ where }),
    ]);
    return {
      items: rows.map((row) => ContentPersistenceMapper.toDomain(row)),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async findPublishedBySlug(type: ContentType, slug: string, now: Date): Promise<Content | null> {
    const r = await this.ctx.db.content.findFirst({ where: { ...publiclyVisible(now), type, slug } });
    return r ? ContentPersistenceMapper.toDomain(r) : null;
  }
}

export class PrismaContentVersionRepository implements ContentVersionRepository {
  constructor(private readonly ctx: PrismaContext) {}

  private static toDomain(r: {
    id: string;
    contentId: string;
    versionNo: number;
    snapshot: Prisma.JsonValue;
    editorId: string | null;
    createdAt: Date;
  }): ContentVersion {
    return { ...r, snapshot: r.snapshot as unknown as ContentSnapshot };
  }

  async append(v: ContentVersion): Promise<void> {
    await this.ctx.db.contentVersion.create({
      data: { ...v, snapshot: v.snapshot as unknown as Prisma.InputJsonValue },
    });
  }

  async list(contentId: string): Promise<ContentVersion[]> {
    const rows = await this.ctx.db.contentVersion.findMany({ where: { contentId }, orderBy: { versionNo: 'desc' } });
    return rows.map((row) => PrismaContentVersionRepository.toDomain(row));
  }

  async find(contentId: string, versionNo: number): Promise<ContentVersion | null> {
    const r = await this.ctx.db.contentVersion.findUnique({ where: { contentId_versionNo: { contentId, versionNo } } });
    return r ? PrismaContentVersionRepository.toDomain(r) : null;
  }

  async latestVersionNo(contentId: string): Promise<number> {
    const r = await this.ctx.db.contentVersion.aggregate({ where: { contentId }, _max: { versionNo: true } });
    return r._max.versionNo ?? 0;
  }

  async prune(contentId: string, keep: number): Promise<void> {
    const cutoff = await this.ctx.db.contentVersion.findMany({
      where: { contentId },
      orderBy: { versionNo: 'desc' },
      skip: keep,
      take: 1,
      select: { versionNo: true },
    });
    const first = cutoff[0];
    if (first)
      await this.ctx.db.contentVersion.deleteMany({ where: { contentId, versionNo: { lte: first.versionNo } } });
  }

  async deleteAll(contentId: string): Promise<void> {
    await this.ctx.db.contentVersion.deleteMany({ where: { contentId } });
  }
}

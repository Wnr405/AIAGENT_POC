import type { MediaItem as MediaRow, Prisma } from '@prisma/client';
import type { PageRequest, PagedResult } from '../../../../../shared/kernel/paged-result';
import type { PrismaContext } from '../../../../../shared/adapters/prisma/prisma-context';
import type { FileKind } from '../../../domain/file-type-policy';
import { MediaItem, type MediaVariants } from '../../../domain/media-item.entity';
import type { MediaRepository, MediaSearchCriteria } from '../../../application/ports/out/media-ports';

export const MediaPersistenceMapper = {
  toDomain(r: MediaRow): MediaItem {
    return MediaItem.rehydrate({
      id: r.id,
      storageKey: r.storageKey,
      filename: r.filename,
      mimeType: r.mimeType,
      kind: r.kind as FileKind,
      sizeBytes: Number(r.sizeBytes),
      width: r.width,
      height: r.height,
      altText: r.altText,
      caption: r.caption,
      variants: r.variants as unknown as MediaVariants,
      uploadedBy: r.uploadedBy,
      createdAt: r.createdAt,
      deletedAt: r.deletedAt,
    });
  },
  toPersistence(m: MediaItem): Prisma.MediaItemUncheckedCreateInput {
    const p = m.toProps();
    return {
      ...p,
      sizeBytes: BigInt(p.sizeBytes),
      variants: p.variants as unknown as Prisma.InputJsonValue,
    };
  },
};

export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly ctx: PrismaContext) {}

  async save(item: MediaItem): Promise<void> {
    const data = MediaPersistenceMapper.toPersistence(item);
    await this.ctx.db.mediaItem.upsert({ where: { id: item.id }, create: data, update: data });
  }

  async findById(id: string): Promise<MediaItem | null> {
    const r = await this.ctx.db.mediaItem.findUnique({ where: { id } });
    return r ? MediaPersistenceMapper.toDomain(r) : null;
  }

  async findByStorageKey(key: string): Promise<MediaItem | null> {
    const r = await this.ctx.db.mediaItem.findUnique({ where: { storageKey: key } });
    return r ? MediaPersistenceMapper.toDomain(r) : null;
  }

  async findMany(c: MediaSearchCriteria, page: PageRequest): Promise<PagedResult<MediaItem>> {
    const where: Prisma.MediaItemWhereInput = {
      deletedAt: null,
      uploadedBy: c.uploadedBy,
      ...(c.kind === 'document' ? { kind: 'pdf' } : c.kind === 'image' ? { kind: { not: 'pdf' } } : {}),
      ...(c.from || c.to ? { createdAt: { gte: c.from, lte: c.to } } : {}),
      ...(c.search
        ? {
            OR: [
              { filename: { contains: c.search, mode: 'insensitive' } },
              { altText: { contains: c.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.ctx.db.mediaItem.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.ctx.db.mediaItem.count({ where }),
    ]);
    return {
      items: rows.map((row) => MediaPersistenceMapper.toDomain(row)),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async existingIds(ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.ctx.db.mediaItem.findMany({
      where: { id: { in: [...ids] }, deletedAt: null },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  async findDeletedBefore(cutoff: Date, limit: number): Promise<MediaItem[]> {
    const rows = await this.ctx.db.mediaItem.findMany({ where: { deletedAt: { lt: cutoff } }, take: limit });
    return rows.map((row) => MediaPersistenceMapper.toDomain(row));
  }

  async hardDelete(id: string): Promise<void> {
    await this.ctx.db.contentMediaRef.deleteMany({ where: { mediaId: id } });
    await this.ctx.db.content.updateMany({ where: { featuredImageId: id }, data: { featuredImageId: null } });
    await this.ctx.db.content.updateMany({ where: { socialImageId: id }, data: { socialImageId: null } });
    await this.ctx.db.mediaItem.delete({ where: { id } });
  }
}

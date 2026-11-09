import { paginate, type PageRequest, type PagedResult } from '../../../../../shared/kernel/paged-result';
import { containsCI, type MemoryDb } from '../../../../../shared/adapters/memory/memory-db';
import { MediaItem, type MediaItemProps } from '../../../domain/media-item.entity';
import type { MediaRepository, MediaSearchCriteria } from '../../../application/ports/out/media-ports';

export class InMemoryMediaRepository implements MediaRepository {
  constructor(private readonly db: MemoryDb) {}

  private get t(): Map<string, MediaItemProps> {
    return this.db.table<MediaItemProps>('media');
  }

  save(item: MediaItem): Promise<void> {
    this.t.set(item.id, structuredClone(item.toProps()));
    return Promise.resolve();
  }

  findById(id: string): Promise<MediaItem | null> {
    const p = this.t.get(id);
    return Promise.resolve(p ? MediaItem.rehydrate(structuredClone(p)) : null);
  }

  findByStorageKey(key: string): Promise<MediaItem | null> {
    const p = [...this.t.values()].find((m) => m.storageKey === key);
    return Promise.resolve(p ? MediaItem.rehydrate(structuredClone(p)) : null);
  }

  findMany(c: MediaSearchCriteria, page: PageRequest): Promise<PagedResult<MediaItem>> {
    const rows = [...this.t.values()]
      .filter((m) => m.deletedAt === null)
      .filter((m) => !c.search || containsCI(m.filename, c.search) || containsCI(m.altText, c.search))
      .filter((m) => !c.uploadedBy || m.uploadedBy === c.uploadedBy)
      .filter((m) => !c.kind || (c.kind === 'document') === (m.kind === 'pdf'))
      .filter((m) => !c.from || m.createdAt >= c.from)
      .filter((m) => !c.to || m.createdAt <= c.to)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve(
      paginate(
        rows.map((p) => MediaItem.rehydrate(structuredClone(p))),
        page,
      ),
    );
  }

  existingIds(ids: readonly string[]): Promise<Set<string>> {
    return Promise.resolve(new Set(ids.filter((id) => this.t.get(id)?.deletedAt === null)));
  }

  findDeletedBefore(cutoff: Date, limit: number): Promise<MediaItem[]> {
    const rows = [...this.t.values()].filter((m) => m.deletedAt !== null && m.deletedAt < cutoff);
    return Promise.resolve(rows.slice(0, limit).map((p) => MediaItem.rehydrate(structuredClone(p))));
  }

  hardDelete(id: string): Promise<void> {
    this.t.delete(id);
    return Promise.resolve();
  }
}

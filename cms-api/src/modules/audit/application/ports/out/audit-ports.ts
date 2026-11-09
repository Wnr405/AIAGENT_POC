import type { PageRequest, PagedResult } from '../../../../../shared/kernel/paged-result';
import type { AuditRecord } from '../../../domain/audit-event';

export interface AuditFilter {
  readonly actorId?: string;
  readonly action?: string; // exact, or prefix when it ends with '.' e.g. 'content.'
  readonly targetType?: string;
  readonly targetId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

/** Append-only: no update, no delete (FR-AUDIT-03). */
export interface AuditEventRepository {
  append(record: AuditRecord): Promise<void>;
  findMany(filter: AuditFilter, page: PageRequest): Promise<PagedResult<AuditRecord>>;
  /** Newest first, in batches — for CSV export without loading everything. */
  iterate(filter: AuditFilter, batchSize: number): AsyncIterable<AuditRecord[]>;
}

export interface ActorDirectory {
  namesByIds(ids: readonly string[]): Promise<Map<string, string>>;
}

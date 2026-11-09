import { paginate, type PageRequest, type PagedResult } from '../../../../../shared/kernel/paged-result';
import type { MemoryDb } from '../../../../../shared/adapters/memory/memory-db';
import type { AuditRecord } from '../../../domain/audit-event';
import type { AuditEventRepository, AuditFilter } from '../../../application/ports/out/audit-ports';

function matchesAction(action: string, filter: string | undefined): boolean {
  if (!filter) return true;
  return filter.endsWith('.') ? action.startsWith(filter) : action === filter;
}

const eqOrAny = (value: string | null | undefined, filter: string | undefined): boolean => !filter || value === filter;

function inRange(at: Date, f: AuditFilter): boolean {
  return !(f.from && at < f.from) && !(f.to && at > f.to);
}

export function matchesAuditFilter(r: AuditRecord, f: AuditFilter): boolean {
  return (
    eqOrAny(r.actorId, f.actorId) &&
    matchesAction(r.action, f.action) &&
    eqOrAny(r.targetType, f.targetType) &&
    eqOrAny(r.targetId, f.targetId) &&
    inRange(r.occurredAt, f)
  );
}

export class InMemoryAuditEventRepository implements AuditEventRepository {
  constructor(private readonly db: MemoryDb) {}

  private get rows(): AuditRecord[] {
    return [...this.db.table<AuditRecord>('audit_events').values()];
  }

  append(record: AuditRecord): Promise<void> {
    const t = this.db.table<AuditRecord>('audit_events');
    if (t.has(record.id)) return Promise.reject(new Error('audit events are append-only'));
    t.set(record.id, Object.freeze({ ...record }));
    return Promise.resolve();
  }

  private filtered(f: AuditFilter): AuditRecord[] {
    return this.rows
      .filter((r) => matchesAuditFilter(r, f))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  findMany(f: AuditFilter, page: PageRequest): Promise<PagedResult<AuditRecord>> {
    return Promise.resolve(paginate(this.filtered(f), page));
  }

  async *iterate(f: AuditFilter, batchSize: number): AsyncIterable<AuditRecord[]> {
    const all = this.filtered(f);
    for (let i = 0; i < all.length; i += batchSize) {
      await Promise.resolve();
      yield all.slice(i, i + batchSize);
    }
  }
}

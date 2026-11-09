import { requireCapability, type ActorContext } from '../../../../shared/kernel/actor';
import type { DomainEvent } from '../../../../shared/kernel/domain-event';
import { pageRequest, type PagedResult } from '../../../../shared/kernel/paged-result';
import type { IdGenerator } from '../../../../shared/ports/id-generator.port';
import { redactSummary, type AuditRecord } from '../../domain/audit-event';
import { AUDIT_CSV_HEADER, auditCsvRow } from '../../domain/csv';
import type { ActorDirectory, AuditEventRepository, AuditFilter } from '../ports/out/audit-ports';

export interface AuditView extends AuditRecord {
  readonly actorName: string | null;
}

/**
 * Internal port: turns any audited domain event into an audit record (BR-03).
 * Subscribed to '*' in the composition root. CRITICAL PATH (append-only write).
 */
export class RecordAuditEvent {
  constructor(private readonly d: { audit: AuditEventRepository; ids: IdGenerator }) {}

  async execute(event: DomainEvent): Promise<void> {
    if (event.audited === false) return;
    await this.d.audit.append({
      id: this.d.ids.next(),
      occurredAt: event.occurredAt,
      actorId: event.actorId,
      actorIp: event.actorIp,
      action: event.type,
      targetType: event.target.type,
      targetId: event.target.id,
      summary: redactSummary(event.summary),
    });
  }
}

/** FR-AUDIT-05 */
export class ListAuditEvents {
  constructor(private readonly d: { audit: AuditEventRepository; actors: ActorDirectory }) {}

  async execute(
    q: AuditFilter & { page?: number; pageSize?: number },
    actor: ActorContext,
  ): Promise<PagedResult<AuditView>> {
    requireCapability(actor, 'audit.read');
    const page = pageRequest(q.page, q.pageSize);
    const result = await this.d.audit.findMany(q, page);
    const ids = result.items.map((r) => r.actorId).filter((x): x is string => x !== null);
    const names = await this.d.actors.namesByIds([...new Set(ids)]);
    return {
      ...result,
      items: result.items.map((r) => ({ ...r, actorName: r.actorId ? (names.get(r.actorId) ?? null) : null })),
    };
  }
}

/** FR-AUDIT-06: streams CSV lines (header first). */
export class ExportAuditCsv {
  constructor(private readonly d: { audit: AuditEventRepository; actors: ActorDirectory }) {}

  /** Authorization is checked eagerly, before the first byte is produced. */
  execute(filter: AuditFilter, actor: ActorContext): AsyncIterable<string> {
    requireCapability(actor, 'audit.read');
    return this.rows(filter);
  }

  private async *rows(filter: AuditFilter): AsyncGenerator<string> {
    yield `${AUDIT_CSV_HEADER.join(',')}\r\n`;
    for await (const batch of this.d.audit.iterate(filter, 500)) {
      const ids = batch.map((r) => r.actorId).filter((x): x is string => x !== null);
      const names = await this.d.actors.namesByIds([...new Set(ids)]);
      yield batch.map((r) => `${auditCsvRow(r, r.actorId ? (names.get(r.actorId) ?? null) : null)}\r\n`).join('');
    }
  }
}

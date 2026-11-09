import type { Prisma } from '@prisma/client';
import type { PageRequest, PagedResult } from '../../../../../shared/kernel/paged-result';
import type { PrismaContext } from '../../../../../shared/adapters/prisma/prisma-context';
import type { AuditRecord } from '../../../domain/audit-event';
import type { AuditEventRepository, AuditFilter } from '../../../application/ports/out/audit-ports';

function where(f: AuditFilter): Prisma.AuditEventWhereInput {
  return {
    actorId: f.actorId,
    targetType: f.targetType,
    targetId: f.targetId,
    ...(f.action ? { action: f.action.endsWith('.') ? { startsWith: f.action } : f.action } : {}),
    ...(f.from || f.to ? { occurredAt: { gte: f.from, lte: f.to } } : {}),
  };
}

const toRecord = (r: {
  id: string;
  occurredAt: Date;
  actorId: string | null;
  actorIp: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: Prisma.JsonValue;
}): AuditRecord => ({ ...r, summary: (r.summary ?? {}) as Record<string, unknown> });

/** Insert + select only. The DB trigger rejects UPDATE/DELETE regardless (FR-AUDIT-03). */
export class PrismaAuditEventRepository implements AuditEventRepository {
  constructor(private readonly ctx: PrismaContext) {}

  async append(r: AuditRecord): Promise<void> {
    await this.ctx.db.auditEvent.create({
      data: { ...r, summary: r.summary as Prisma.InputJsonValue },
    });
  }

  async findMany(f: AuditFilter, page: PageRequest): Promise<PagedResult<AuditRecord>> {
    const w = where(f);
    const [rows, total] = await Promise.all([
      this.ctx.db.auditEvent.findMany({
        where: w,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.ctx.db.auditEvent.count({ where: w }),
    ]);
    return { items: rows.map(toRecord), total, page: page.page, pageSize: page.pageSize };
  }

  /** Keyset pagination so exporting millions of rows stays O(batch). */
  async *iterate(f: AuditFilter, batchSize: number): AsyncIterable<AuditRecord[]> {
    let cursor: { occurredAt: Date; id: string } | null = null;
    for (;;) {
      const page: AuditRecord[] = (
        await this.ctx.db.auditEvent.findMany({
          where: {
            AND: [
              where(f),
              cursor
                ? {
                    OR: [
                      { occurredAt: { lt: cursor.occurredAt } },
                      { occurredAt: cursor.occurredAt, id: { lt: cursor.id } },
                    ],
                  }
                : {},
            ],
          },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          take: batchSize,
        })
      ).map(toRecord);
      if (page.length === 0) return;
      yield page;
      const last = page[page.length - 1] as AuditRecord;
      cursor = { occurredAt: last.occurredAt, id: last.id };
      if (page.length < batchSize) return;
    }
  }
}

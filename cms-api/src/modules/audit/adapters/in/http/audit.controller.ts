import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { Container } from '../../../../../composition/container';
import type { ActorContext } from '../../../../../shared/kernel/actor';
import { Actor, Roles } from '../../../../../shared/http/decorators';
import { listEnvelope } from '../../../../../shared/http/envelope';
import { CONTAINER } from '../../../../../shared/http/tokens';
import { parse } from '../../../../../shared/http/validation';

export const AuditQuery = z.object({
  actor_id: z.string().uuid().optional(),
  action: z.string().max(80).optional(),
  target_type: z.string().max(40).optional(),
  target_id: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().optional(),
  page_size: z.coerce.number().int().optional(),
});

function filter(q: z.infer<typeof AuditQuery>) {
  return {
    actorId: q.actor_id,
    action: q.action,
    targetType: q.target_type,
    targetId: q.target_id,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
  };
}

/**
 * FR-AUDIT-03/05/06. Read-only by construction: there is no POST/PATCH/PUT/DELETE
 * route on this controller (a test asserts it).
 */
@Controller('api/admin/audit')
@Roles('admin')
export class AuditController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get()
  async list(@Query() query: unknown, @Actor() actor: ActorContext) {
    const q = parse(AuditQuery, query);
    const result = await this.c.audit.list.execute({ ...filter(q), page: q.page, pageSize: q.page_size }, actor);
    return listEnvelope(result, (e) => e);
  }

  @Get('export.csv')
  async export(@Query() query: unknown, @Actor() actor: ActorContext, @Res() res: Response): Promise<void> {
    const rows = this.c.audit.exportCsv.execute(filter(parse(AuditQuery, query)), actor);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    for await (const chunk of rows) {
      if (!res.write(chunk)) await new Promise<void>((resolve) => res.once('drain', () => resolve()));
    }
    res.end();
  }
}

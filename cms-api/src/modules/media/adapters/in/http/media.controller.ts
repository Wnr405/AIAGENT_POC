import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import type { Container } from '../../../../../composition/container';
import type { ActorContext } from '../../../../../shared/kernel/actor';
import { Actor, RateLimit } from '../../../../../shared/http/decorators';
import { listEnvelope } from '../../../../../shared/http/envelope';
import { CONTAINER } from '../../../../../shared/http/tokens';
import { parse } from '../../../../../shared/http/validation';

export const PresignRequest = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});
export const FinalizeRequest = z.object({
  storageKey: z.string().min(1).max(500),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  altText: z.string().max(500).nullable().optional(),
  caption: z.string().max(1000).nullable().optional(),
});
export const UpdateMediaRequest = z.object({
  altText: z.string().max(500).nullable().optional(),
  caption: z.string().max(1000).nullable().optional(),
});
export const ListMediaQuery = z.object({
  search: z.string().max(200).optional(),
  uploaded_by: z.string().uuid().optional(),
  kind: z.enum(['image', 'document']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().optional(),
  page_size: z.coerce.number().int().optional(),
});
const DeleteMediaQuery = z.object({ force: z.enum(['true', 'false']).optional() });

/** FR-MEDIA-*: presign → direct upload → finalize (the API never proxies file bytes). */
@Controller('api/admin/media')
export class MediaController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Post('presign')
  @RateLimit('admin_mutation')
  @HttpCode(200)
  presign(@Body() body: unknown, @Actor() actor: ActorContext) {
    return this.c.media.presign.execute(parse(PresignRequest, body), actor);
  }

  @Post()
  @RateLimit('admin_mutation')
  finalize(@Body() body: unknown, @Actor() actor: ActorContext) {
    return this.c.media.finalize.execute(parse(FinalizeRequest, body), actor);
  }

  @Get()
  async list(@Query() query: unknown, @Actor() actor: ActorContext) {
    const q = parse(ListMediaQuery, query);
    const result = await this.c.media.list.execute(
      {
        search: q.search,
        uploadedBy: q.uploaded_by,
        kind: q.kind,
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        page: q.page,
        pageSize: q.page_size,
      },
      actor,
    );
    return listEnvelope(result, (m) => m);
  }

  @Get(':id')
  get(@Param('id') id: string, @Actor() actor: ActorContext) {
    return this.c.media.get.execute(id, actor);
  }

  @Patch(':id')
  @RateLimit('admin_mutation')
  update(@Param('id') id: string, @Body() body: unknown, @Actor() actor: ActorContext) {
    return this.c.media.update.execute(id, parse(UpdateMediaRequest, body), actor);
  }

  @Delete(':id')
  @RateLimit('admin_mutation')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Query() query: unknown, @Actor() actor: ActorContext): Promise<void> {
    await this.c.media.delete.execute(id, { force: parse(DeleteMediaQuery, query).force === 'true' }, actor);
  }
}

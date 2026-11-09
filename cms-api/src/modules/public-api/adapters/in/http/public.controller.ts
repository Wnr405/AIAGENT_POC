import { Controller, Get, Inject, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { Container } from '../../../../../composition/container';
import { Public } from '../../../../../shared/http/decorators';
import { listEnvelope } from '../../../../../shared/http/envelope';
import { ApiKeyGuard } from '../../../../../shared/http/guards';
import type { CmsRequest } from '../../../../../shared/http/request';
import { CONTAINER } from '../../../../../shared/http/tokens';
import { parse } from '../../../../../shared/http/validation';
import { PUBLIC_CACHE_TTL_SECONDS } from '../../../application/use-cases/public.use-cases';
import { etagFor, lastModified, presentDetail, presentMedia, presentSummary } from './public.presenter';

export const PublicListQuery = z.object({
  page: z.coerce.number().int().optional(),
  page_size: z.coerce.number().int().optional(),
  tag: z.string().max(40).optional(),
  category: z.string().max(60).optional(),
});
const SlugParam = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(120);

/**
 * Public read-only API (BR-04, FR-PUBAPI-01..06). Authenticated by X-API-Key
 * (not JWT), rate-limited per key, cacheable (Cache-Control/ETag/Last-Modified).
 */
@Controller('api/v1')
@Public()
@UseGuards(ApiKeyGuard)
export class PublicContentController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  private send(req: CmsRequest, res: Response, payload: unknown, modified: Date | null): void {
    const etag = etagFor(payload);
    res.setHeader('Cache-Control', `public, max-age=${PUBLIC_CACHE_TTL_SECONDS}, stale-while-revalidate=30`);
    res.setHeader('ETag', etag);
    res.setHeader('Vary', 'X-API-Key');
    if (modified) res.setHeader('Last-Modified', modified.toUTCString());
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.status(200).json(payload);
  }

  private async list(type: 'article' | 'page', query: unknown, req: CmsRequest, res: Response): Promise<void> {
    const q = parse(PublicListQuery, query);
    const result = await this.c.publicApi.list.execute(type, { ...q, pageSize: q.page_size });
    this.send(req, res, listEnvelope(result, presentSummary), lastModified(result.items));
  }

  private async detail(type: 'article' | 'page', slug: string, req: CmsRequest, res: Response): Promise<void> {
    const item = await this.c.publicApi.getBySlug.execute(type, parse(SlugParam, slug));
    this.send(req, res, { data: presentDetail(item) }, item.updatedAt);
  }

  @Get('articles')
  articles(@Query() q: unknown, @Req() req: CmsRequest, @Res() res: Response): Promise<void> {
    return this.list('article', q, req, res);
  }

  @Get('articles/:slug')
  article(@Param('slug') slug: string, @Req() req: CmsRequest, @Res() res: Response): Promise<void> {
    return this.detail('article', slug, req, res);
  }

  @Get('pages')
  pages(@Query() q: unknown, @Req() req: CmsRequest, @Res() res: Response): Promise<void> {
    return this.list('page', q, req, res);
  }

  @Get('pages/:slug')
  page(@Param('slug') slug: string, @Req() req: CmsRequest, @Res() res: Response): Promise<void> {
    return this.detail('page', slug, req, res);
  }

  @Get('media/:id')
  async media(@Param('id') id: string, @Req() req: CmsRequest, @Res() res: Response): Promise<void> {
    const m = await this.c.publicApi.getMedia.execute(parse(z.string().uuid(), id));
    this.send(req, res, { data: presentMedia(m) }, null);
  }
}

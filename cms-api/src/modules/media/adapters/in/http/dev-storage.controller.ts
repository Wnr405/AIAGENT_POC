import { Controller, Get, HttpCode, Inject, NotFoundException, Param, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Container } from '../../../../../composition/container';
import { Public } from '../../../../../shared/http/decorators';
import { CONTAINER } from '../../../../../shared/http/tokens';
import type { InMemoryObjectStorage } from '../../out/storage/in-memory-object-storage';

/**
 * PERSISTENCE=memory ONLY (never registered otherwise): stands in for S3 so the
 * presigned-upload flow works in demos and Playwright runs without MinIO.
 */
@Controller('api/dev/storage')
@Public()
export class DevStorageController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  private get storage(): InMemoryObjectStorage {
    return this.c.infra.storage as InMemoryObjectStorage;
  }

  @Put(':key')
  @HttpCode(200)
  async put(@Param('key') key: string, @Req() req: Request): Promise<void> {
    const body = req.body as Buffer;
    await this.storage.put(key, new Uint8Array(body), req.headers['content-type'] ?? 'application/octet-stream');
  }

  @Get(':key')
  get(@Param('key') key: string, @Res() res: Response): void {
    const obj = this.storage.objects.get(key);
    if (!obj) throw new NotFoundException();
    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.send(Buffer.from(obj.data));
  }
}

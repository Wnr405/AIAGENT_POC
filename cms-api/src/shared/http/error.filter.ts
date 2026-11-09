import { Catch, Inject, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import type { Container } from '../../composition/container';
import { toHttpError } from './error-mapping';
import { routePath, type CmsRequest } from './request';
import { CONTAINER } from './tokens';
import { captureException } from './sentry';

/** Every error leaves the API in the standard envelope (FR-PUBAPI-06). */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<CmsRequest>();
    const mapped = toHttpError(exception);
    if (mapped.unexpected) {
      this.c.infra.logger.error('unhandled error', {
        requestId: req.requestId,
        userId: req.actor?.userId,
        route: routePath(req),
        error: exception instanceof Error ? exception.stack : String(exception),
      });
      captureException(exception, { requestId: req.requestId, userId: req.actor?.userId });
    }
    for (const [k, v] of Object.entries(mapped.headers ?? {})) res.setHeader(k, v);
    res.status(mapped.status).json(mapped.body);
  }
}

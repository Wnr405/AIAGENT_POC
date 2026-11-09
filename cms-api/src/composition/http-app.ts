import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { accessLog, requestId, securityHeaders } from '../shared/http/middleware';
import type { HttpRuntime } from '../shared/http/runtime';
import { AppModule } from './app.module';
import type { Container } from './container';

export interface HttpOptions {
  readonly corsOrigins: readonly string[];
  readonly bodyLimitMb: number;
  readonly trustProxy: boolean;
  readonly devUploadLimitMb: number;
}

/** Shared by main.ts and the E2E tests so both exercise the exact same HTTP pipeline. */
export async function createHttpApp(
  container: Container,
  runtime: HttpRuntime,
  opts: HttpOptions,
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(container, runtime), {
    bodyParser: false,
    logger: ['error', 'warn'],
  });
  app.disable('x-powered-by');
  if (opts.trustProxy) app.set('trust proxy', 1);
  app.use(requestId, securityHeaders, accessLog(container.infra.logger), cookieParser());
  if (runtime.persistence === 'memory') {
    app.use('/api/dev/storage', express.raw({ type: () => true, limit: `${opts.devUploadLimitMb}mb` }));
  }
  app.use(express.json({ limit: `${opts.bodyLimitMb}mb` }));
  app.enableCors({
    origin: opts.corsOrigins.length > 0 ? [...opts.corsOrigins] : false,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-API-Key', 'X-Request-Id', 'X-CMS-CSRF', 'If-None-Match'],
    exposedHeaders: ['X-Request-Id', 'ETag', 'Retry-After'],
  });
  return app;
}

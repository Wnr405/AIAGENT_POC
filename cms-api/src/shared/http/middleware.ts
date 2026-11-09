import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { Logger } from '../ports/logger.port';
import { routePath, type CmsRequest } from './request';
import { httpMetrics } from './metrics';

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;

/** 04-ARCH §7.1: every request carries X-Request-Id (created if missing or malformed). */
export function requestId(req: CmsRequest, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/** SEC-02 baseline headers (nginx sets them too; defence in depth for direct access). */
export function securityHeaders(req: CmsRequest, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (!req.path.startsWith('/api/docs')) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  }
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
}

/** NFR-OBS-01/02: one structured log line + metrics per request (user id only, no PII). */
export function accessLog(logger: Logger) {
  return (req: CmsRequest, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = routePath(req) ?? 'unmatched';
      httpMetrics.observe(req.method, route, res.statusCode, seconds);
      if (req.path === '/healthz' || req.path === '/metrics') return;
      logger.info('http', {
        requestId: req.requestId,
        userId: req.actor?.userId,
        apiKeyId: req.apiKeyId,
        method: req.method,
        route,
        status: res.statusCode,
        latencyMs: Math.round(seconds * 1000),
      });
    });
    next();
  };
}

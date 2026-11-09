import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from '../kernel/errors';
import type { Request } from 'express';
import { listEnvelope } from './envelope';
import { clientIp, routePath } from './request';
import { toHttpError } from './error-mapping';
import { parse } from './validation';

describe('toHttpError (04-ARCH §6.4)', () => {
  it.each([
    [new ValidationError('v', { field: 'slug' }), 422, 'VALIDATION_ERROR'],
    [new NotFoundError('Content', 'c1'), 404, 'NOT_FOUND'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    [new ConflictError('c'), 409, 'CONFLICT'],
    [new RateLimitedError(30), 429, 'RATE_LIMITED'],
  ])('maps %s', (err: Error, status: number, code: string) => {
    const r = toHttpError(err);
    expect([r.status, r.body.error.code, r.unexpected]).toEqual([status, code, false]);
  });

  it('includes details only when present and Retry-After for 429', () => {
    expect(toHttpError(new ConflictError('c')).body).toEqual({ error: { code: 'CONFLICT', message: 'c' } });
    expect(toHttpError(new ValidationError('v', { field: 'slug' })).body.error.details).toEqual({ field: 'slug' });
    expect(toHttpError(new RateLimitedError(30)).headers).toEqual({ 'Retry-After': '30' });
  });

  it('maps zod errors to 422 with field paths', () => {
    let err: unknown;
    try {
      z.object({ title: z.string(), nested: z.object({ n: z.number() }) }).parse({ nested: { n: 'x' } });
    } catch (e) {
      err = e;
    }
    const r = toHttpError(err);
    expect(r.status).toBe(422);
    expect(r.body.error.details).toEqual({
      fields: [
        { field: 'title', message: 'Required' },
        { field: 'nested.n', message: 'Expected number, received string' },
      ],
    });
  });

  it('maps framework HTTP exceptions without leaking 5xx messages', () => {
    const http = (status: number, message: string) => ({ getStatus: () => status, message });
    expect(toHttpError(http(404, 'Cannot GET /x')).body.error).toEqual({ code: 'NOT_FOUND', message: 'Cannot GET /x' });
    expect(toHttpError(http(413, 'too big')).body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(toHttpError(http(400, 'bad')).body.error.code).toBe('BAD_REQUEST');
    expect(toHttpError({ getStatus: () => 400 }).body.error.message).toBe('Bad request');
    const r = toHttpError(http(503, 'db host 10.0.0.5 down'));
    expect([r.status, r.body.error.message, r.unexpected]).toEqual([503, 'Internal server error', true]);
  });

  it('maps body-parser errors to 400 and anything else to an opaque 500', () => {
    expect(toHttpError({ status: 400, type: 'entity.parse.failed' }).status).toBe(400);
    const r = toHttpError(new Error('secret internals'));
    expect([r.status, r.body.error.message, r.unexpected]).toEqual([500, 'Internal server error', true]);
    expect(toHttpError(null).status).toBe(500);
    expect(toHttpError({ status: 502 }).status).toBe(500);
  });
});

describe('toHttpError fallbacks', () => {
  it('maps any other domain error to 400 with its own code', () => {
    class TeapotError extends DomainError {
      readonly code = 'TEAPOT';
    }
    const r = toHttpError(new TeapotError('short and stout'));
    expect([r.status, r.body.error.code, r.headers]).toEqual([400, 'TEAPOT', undefined]);
  });
});

describe('request helpers', () => {
  const req = (over: Record<string, unknown>) => over as unknown as Request;

  it('clientIp prefers the resolved ip, then the socket, then a placeholder', () => {
    expect(clientIp(req({ ip: '203.0.113.9', socket: {} }))).toBe('203.0.113.9');
    expect(clientIp(req({ socket: { remoteAddress: '198.51.100.1' } }))).toBe('198.51.100.1');
    expect(clientIp(req({ socket: {} }))).toBe('0.0.0.0');
  });

  it('routePath returns the matched pattern only', () => {
    expect(routePath(req({ route: { path: '/api/admin/content/:id' } }))).toBe('/api/admin/content/:id');
    expect(routePath(req({ route: { path: /regex/ } }))).toBeUndefined();
    expect(routePath(req({}))).toBeUndefined();
  });
});

describe('listEnvelope (02-SRS §7.3)', () => {
  it('wraps items with snake_case pagination', () => {
    expect(listEnvelope({ items: [1, 2], total: 137, page: 1, pageSize: 25 }, (n) => n * 2)).toEqual({
      data: [2, 4],
      pagination: { page: 1, page_size: 25, total: 137, total_pages: 6 },
    });
  });
});

describe('parse', () => {
  it('returns typed data or throws ZodError', () => {
    expect(parse(z.object({ a: z.number() }), { a: 1 })).toEqual({ a: 1 });
    expect(() => parse(z.string(), 1)).toThrow();
  });
});

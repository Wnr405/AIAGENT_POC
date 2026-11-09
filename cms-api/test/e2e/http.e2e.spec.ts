import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpApp } from '../../src/composition/http-app';
import type { HttpRuntime } from '../../src/shared/http/runtime';
import { createTestApp, doc, STRONG_PASSWORD, type TestApp } from '../support/test-app';

/**
 * Full HTTP pipeline (guards, filters, cookies, headers) over in-memory adapters.
 * 02-SRS §11.1 DoD #3: primary happy path through the API + key acceptance tests.
 */
const runtime: HttpRuntime = {
  persistence: 'memory',
  version: 'test',
  readinessChecks: {},
  refreshCookie: { name: 'cms_rt', secure: false, path: '/api/admin/auth' },
  rateLimits: {
    login: { limit: 10, windowSeconds: 60 },
    password_reset: { limit: 5, windowSeconds: 3600 },
    public_api: { limit: 3, windowSeconds: 60 },
    admin_mutation: { limit: 1000, windowSeconds: 60 },
  },
};

describe('HTTP API (E2E, in-memory adapters)', () => {
  let t: TestApp;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const tokens: Record<string, string> = {};

  const login = async (email: string) => {
    const res = await http.post('/api/admin/auth/login').send({ email, password: STRONG_PASSWORD });
    expect(res.status).toBe(200);
    return res;
  };

  beforeAll(async () => {
    t = createTestApp();
    t.seedUser('admin', 'Ada', 'ada@example.com');
    t.seedUser('editor', 'Eve', 'eve@example.com');
    t.seedUser('author', 'Al', 'al@example.com');
    app = await createHttpApp(t.app, runtime, {
      corsOrigins: [],
      bodyLimitMb: 1,
      trustProxy: false,
      devUploadLimitMb: 21,
    });
    await app.init();
    http = request(app.getHttpServer());
    for (const who of ['ada', 'eve', 'al'])
      tokens[who] = (await login(`${who}@example.com`)).body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  it('health, request id and security headers (NFR-AVAIL-05, SEC-02)', async () => {
    const res = await http.get('/healthz').set('X-Request-Id', 'test-request-0001');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', version: 'test' });
    expect(res.headers['x-request-id']).toBe('test-request-0001');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect((await http.get('/readyz')).status).toBe(200);
    expect((await http.get('/metrics')).text).toContain('cms_http_requests_total');
  });

  it('login sets an httpOnly SameSite=Strict refresh cookie; refresh needs the CSRF header', async () => {
    const res = await login('eve@example.com');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/cms_rt=.+HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/admin\/auth/);
    expect((await http.post('/api/admin/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    const refreshed = await http.post('/api/admin/auth/refresh').set('Cookie', cookie).set('X-CMS-CSRF', '1');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.user.email).toBe('eve@example.com');
    const out = await http
      .post('/api/admin/auth/logout')
      .set('Cookie', String(refreshed.headers['set-cookie']))
      .set('X-CMS-CSRF', '1');
    expect(out.status).toBe(204);
  });

  it('FR-AUTH-06: generic 401 envelope for bad credentials', async () => {
    const res = await http
      .post('/api/admin/auth/login')
      .send({ email: 'eve@example.com', password: 'wrong-password-9' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } });
  });

  it('FR-AUTHZ-01/05, FR-PUBAPI-06: 401 without token, 403 at the route layer, 422 on invalid body — all in the error envelope', async () => {
    expect((await http.get('/api/admin/users')).status).toBe(401);
    const forbidden = await http.get('/api/admin/users').set(as('eve'));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    expect((await http.get('/api/admin/users').set(as('ada'))).body.pagination).toMatchObject({
      page: 1,
      page_size: 25,
      total: 3,
    });
    const invalid = await http.post('/api/admin/content').set(as('al')).send({ type: 'blog' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.details.fields.map((f: { field: string }) => f.field).sort()).toEqual(['title', 'type']);
    expect(
      (await http.post('/api/admin/content').set(as('al')).set('Content-Type', 'application/json').send('{bad')).status,
    ).toBe(400);
  });

  it('primary happy path: author drafts → submits → editor publishes → public API serves it (BR-01/02/04)', async () => {
    const created = await http
      .post('/api/admin/content')
      .set(as('al'))
      .send({ type: 'article', title: 'Launch Day', body: doc('We launched.'), tags: ['News'] });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect((await http.post(`/api/admin/content/${id}/publish`).set(as('al'))).status).toBe(403);
    expect((await http.post(`/api/admin/content/${id}/submit`).set(as('al'))).body.status).toBe('in_review');
    expect((await http.post(`/api/admin/content/${id}/submit`).set(as('al'))).status).toBe(409);
    expect((await http.post(`/api/admin/content/${id}/publish`).set(as('eve'))).body.status).toBe('published');

    const key = (await http.post('/api/admin/api-keys').set(as('ada')).send({ name: 'Web' })).body.key as string;
    expect((await http.get('/api/v1/articles')).status).toBe(401);
    const list = await http.get('/api/v1/articles').set('X-API-Key', key);
    expect(list.status).toBe(200);
    expect(list.body.data.map((a: { slug: string }) => a.slug)).toEqual(['launch-day']);
    expect(list.headers['cache-control']).toContain('max-age=30'); // FR-PUBAPI-04
    expect((await http.post('/api/v1/articles').set('X-API-Key', key)).status).toBe(404); // FR-PUBAPI-01: read-only
    const detail = await http.get('/api/v1/articles/launch-day').set('X-API-Key', key);
    expect(detail.body.data).toMatchObject({
      title: 'Launch Day',
      body_html: '<p>We launched.</p>',
      tags: ['news'],
      author: { name: 'Al' },
    });
    expect(detail.headers['last-modified']).toBeDefined();
    const notModified = await http
      .get('/api/v1/articles/launch-day')
      .set('X-API-Key', key)
      .set('If-None-Match', String(detail.headers['etag']));
    expect(notModified.status).toBe(304);
    // SEC-07: per-key public rate limit (3/min in this test runtime)
    const limited = await http.get('/api/v1/pages').set('X-API-Key', key);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('FR-AUTHZ-06: drafts are never served publicly', async () => {
    await http
      .post('/api/admin/content')
      .set(as('eve'))
      .send({ type: 'page', title: 'Secret Draft', body: doc('x') });
    const key = (await http.post('/api/admin/api-keys').set(as('ada')).send({ name: 'Draft check' })).body
      .key as string;
    expect((await http.get('/api/v1/pages/secret-draft').set('X-API-Key', key)).status).toBe(404);
  });

  it('FR-AUDIT-03: the audit log exposes no mutation routes; admins can read and export it', async () => {
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      expect((await http[method]('/api/admin/audit/00000000-0000-4000-8000-000000000001').set(as('ada'))).status).toBe(
        404,
      );
    }
    expect((await http.get('/api/admin/audit').set(as('eve'))).status).toBe(403);
    const audit = await http.get('/api/admin/audit?action=content.').set(as('ada'));
    expect(audit.body.data.length).toBeGreaterThan(0);
    const csv = await http.get('/api/admin/audit/export.csv').set(as('ada'));
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\r\n')[0]).toBe(
      'id,occurred_at,actor_id,actor_name,actor_ip,action,target_type,target_id,summary',
    );
  });

  it('media upload flow through the dev storage endpoint (FR-MEDIA-04)', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    const presign = await http
      .post('/api/admin/media/presign')
      .set(as('al'))
      .send({ filename: 'a.png', mimeType: 'image/png', sizeBytes: png.length });
    expect(presign.status).toBe(200);
    const key = presign.body.storageKey as string;
    expect(
      (
        await http
          .put(`/api/dev/storage/${encodeURIComponent(key)}`)
          .set('Content-Type', 'image/png')
          .send(png)
      ).status,
    ).toBe(200);
    const fin = await http
      .post('/api/admin/media')
      .set(as('al'))
      .send({ storageKey: key, filename: 'a.png', mimeType: 'image/png', altText: 'A' });
    expect(fin.status).toBe(201);
    expect((await http.get('/api/admin/media').set(as('al'))).body.data[0].altText).toBe('A');
  });

  it('OpenAPI 3.1 is published (FR-PUBAPI-07)', async () => {
    const res = await http.get('/api/docs/openapi.json');
    expect(res.body.openapi).toBe('3.1.0');
    expect(Object.keys(res.body.paths)).toContain('/api/v1/articles/{slug}');
    expect((await http.get('/api/docs')).text).toContain('<redoc');
  });

  it('SEC-07: login is rate limited per IP', async () => {
    let last = 200;
    for (let i = 0; i < 12; i++)
      last = (await http.post('/api/admin/auth/login').send({ email: 'x@example.com', password: 'y' })).status;
    expect(last).toBe(429);
  });
});

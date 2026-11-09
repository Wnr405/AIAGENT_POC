import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpApp } from '../../src/composition/http-app';
import type { HttpRuntime } from '../../src/shared/http/runtime';
import { createTestApp, doc, STRONG_PASSWORD, type TestApp } from '../support/test-app';

/**
 * Every admin and public route through the full Nest pipeline (02-SRS §7, §11.1 DoD #3):
 * content lifecycle, users, auth self-service, media, public pages/media, probes and the
 * unexpected-error path. Rate limits are generous here; limits are covered in http.e2e.spec.ts.
 */
const readinessChecks: Record<string, () => Promise<void>> = {};
const runtime: HttpRuntime = {
  persistence: 'memory',
  version: 'test',
  readinessChecks,
  refreshCookie: { name: 'cms_rt', secure: false, path: '/api/admin/auth' },
  rateLimits: {
    login: { limit: 100, windowSeconds: 60 },
    password_reset: { limit: 100, windowSeconds: 3600 },
    public_api: { limit: 100, windowSeconds: 60 },
    admin_mutation: { limit: 1000, windowSeconds: 60 },
  },
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

describe('admin + public routes (E2E, in-memory adapters)', () => {
  let t: TestApp;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const tokens: Record<string, string> = {};
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  const login = async (email: string, password = STRONG_PASSWORD) =>
    http.post('/api/admin/auth/login').send({ email, password });

  const storageKeys: string[] = [];
  const uploadImage = async (who: string, altText: string | null = 'Alt'): Promise<string> => {
    const presign = await http
      .post('/api/admin/media/presign')
      .set(as(who))
      .send({ filename: 'p.png', mimeType: 'image/png', sizeBytes: PNG.length });
    const key = presign.body.storageKey as string;
    storageKeys.push(key);
    await http
      .put(`/api/dev/storage/${encodeURIComponent(key)}`)
      .set('Content-Type', 'image/png')
      .send(PNG);
    const fin = await http
      .post('/api/admin/media')
      .set(as(who))
      .send({ storageKey: key, filename: 'p.png', mimeType: 'image/png', altText });
    expect(fin.status).toBe(201);
    return fin.body.id as string;
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

  it('FR-CONTENT-01/02/05/09: list filters, categories, stats, get and update', async () => {
    const created = await http
      .post('/api/admin/content')
      .set(as('al'))
      .send({ type: 'article', title: 'Filter Me', body: doc('Body'), tags: ['Alpha'] });
    const id = created.body.id as string;

    const from = new Date(Date.UTC(2020, 0, 1)).toISOString();
    const to = new Date(Date.UTC(2100, 0, 1)).toISOString();
    const list = await http
      .get(
        `/api/admin/content?type=article&status=draft&tag=alpha&search=Filter&updated_from=${from}&updated_to=${to}&sort=title&order=asc&page=1&page_size=10`,
      )
      .set(as('al'));
    expect(list.status).toBe(200);
    expect(list.body.data.map((c: { id: string }) => c.id)).toContain(id);
    expect(list.body.pagination).toMatchObject({ page: 1, page_size: 10 });
    expect((await http.get('/api/admin/content').set(as('al'))).status).toBe(200);

    expect((await http.get('/api/admin/content/categories').set(as('al'))).body.data).toEqual(
      expect.arrayContaining(['News']),
    );
    const stats = await http.get('/api/admin/content/stats').set(as('eve'));
    expect(stats.status).toBe(200);

    expect((await http.get(`/api/admin/content/${id}`).set(as('al'))).body.title).toBe('Filter Me');
    const patched = await http
      .patch(`/api/admin/content/${id}`)
      .set(as('al'))
      .send({ title: 'Filtered', category: 'News' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ title: 'Filtered', category: 'News' });
  });

  it('FR-CONTENT-06/07/08/13: reject, publish, unpublish, archive, schedule, versions, revert, delete', async () => {
    const id = (
      await http
        .post('/api/admin/content')
        .set(as('al'))
        .send({ type: 'article', title: 'Lifecycle', body: doc('v1') })
    ).body.id as string;
    await http
      .patch(`/api/admin/content/${id}`)
      .set(as('al'))
      .send({ body: doc('v2') });

    expect((await http.post(`/api/admin/content/${id}/submit`).set(as('al'))).body.status).toBe('in_review');
    expect((await http.post(`/api/admin/content/${id}/reject`).set(as('eve'))).body.status).toBe('draft');
    await http.post(`/api/admin/content/${id}/submit`).set(as('al'));
    expect((await http.post(`/api/admin/content/${id}/publish`).set(as('eve'))).body.status).toBe('published');
    expect((await http.post(`/api/admin/content/${id}/unpublish`).set(as('eve'))).body.status).toBe('unpublished');
    expect((await http.post(`/api/admin/content/${id}/archive`).set(as('eve'))).body.status).toBe('archived');

    const versions = await http.get(`/api/admin/content/${id}/versions`).set(as('al'));
    expect(versions.status).toBe(200);
    expect(versions.body.data.length).toBeGreaterThan(0);

    const draft = (
      await http
        .post('/api/admin/content')
        .set(as('eve'))
        .send({ type: 'article', title: 'Scheduled', body: doc('s1') })
    ).body.id as string;
    await http
      .patch(`/api/admin/content/${draft}`)
      .set(as('eve'))
      .send({ body: doc('s2') });
    const at = new Date(t.clock.now().getTime() + 86_400_000).toISOString();
    expect(
      (await http.post(`/api/admin/content/${draft}/schedule`).set(as('eve')).send({ scheduledAt: at })).body
        .scheduledAt,
    ).toBe(at);
    expect(
      (await http.post(`/api/admin/content/${draft}/schedule`).set(as('eve')).send({ scheduledAt: null })).body
        .scheduledAt,
    ).toBeNull();

    const reverted = await http.post(`/api/admin/content/${draft}/revert/1`).set(as('eve'));
    expect(reverted.status).toBe(200);
    expect((await http.post(`/api/admin/content/${draft}/revert/not-a-number`).set(as('eve'))).status).toBe(400);

    expect((await http.delete(`/api/admin/content/${draft}`).set(as('eve'))).status).toBe(204);
    expect((await http.get(`/api/admin/content/${draft}`).set(as('eve'))).status).toBe(404);
  });

  it('UR-A01..A05: invite, list, update, reset password, deactivate', async () => {
    const invited = await http
      .post('/api/admin/users')
      .set(as('ada'))
      .send({ email: 'new@example.com', name: 'Newbie', role: 'author' });
    expect(invited.status).toBe(201);
    const id = invited.body.id as string;

    const list = await http
      .get('/api/admin/users?search=new%40example&role=author&status=invited&page=1&page_size=5')
      .set(as('ada'));
    expect(list.body.data.map((u: { id: string }) => u.id)).toEqual([id]);

    expect((await http.patch(`/api/admin/users/${id}`).set(as('ada')).send({ name: 'Renamed' })).body.name).toBe(
      'Renamed',
    );
    expect((await http.patch(`/api/admin/users/${id}`).set(as('ada')).send({})).status).toBe(422);
    const reset = await http.post(`/api/admin/users/${id}/reset-password`).set(as('ada'));
    expect([reset.status, reset.body]).toEqual([202, { status: 'accepted' }]);
    expect((await http.post(`/api/admin/users/${id}/deactivate`).set(as('ada'))).body.status).toBe('deactivated');
  });

  it('FR-USER-02, FR-AUTH-05/07/08: accept invite, forgot/reset password, me, change own password', async () => {
    await http
      .post('/api/admin/users')
      .set(as('ada'))
      .send({ email: 'joiner@example.com', name: 'Joiner', role: 'editor' });
    const inviteToken = t.mail.lastTokenFor('joiner@example.com');
    expect(
      (await http.post('/api/admin/auth/invite/accept').send({ token: inviteToken, password: STRONG_PASSWORD })).status,
    ).toBe(204);
    const joined = await login('joiner@example.com');
    expect(joined.status).toBe(200);
    const bearer = { Authorization: `Bearer ${joined.body.accessToken as string}` };
    expect((await http.get('/api/admin/auth/me').set(bearer)).body.email).toBe('joiner@example.com');

    const forgot = await http.post('/api/admin/auth/password/forgot').send({ email: 'joiner@example.com' });
    expect([forgot.status, forgot.body]).toEqual([202, { status: 'accepted' }]);
    const resetToken = t.mail.lastTokenFor('joiner@example.com');
    const newPassword = 'another-horse-77';
    expect(
      (await http.post('/api/admin/auth/password/reset').send({ token: resetToken, password: newPassword })).status,
    ).toBe(204);

    const again = await login('joiner@example.com', newPassword);
    const bearer2 = { Authorization: `Bearer ${again.body.accessToken as string}` };
    const changed = await http
      .post('/api/admin/auth/me/password')
      .set(bearer2)
      .send({ currentPassword: newPassword, newPassword: STRONG_PASSWORD });
    expect(changed.status).toBe(204);
    expect(String(changed.headers['set-cookie'])).toMatch(/cms_rt=;/);
  });

  it('FR-AUTH-04: refresh without a cookie is 401; a bad refresh token clears the cookie', async () => {
    expect((await http.post('/api/admin/auth/refresh').set('X-CMS-CSRF', '1')).status).toBe(401);
    const bad = await http
      .post('/api/admin/auth/refresh')
      .set('X-CMS-CSRF', '1')
      .set('Cookie', 'cms_rt=not-a-real-token');
    expect(bad.status).toBe(401);
    expect(String(bad.headers['set-cookie'])).toMatch(/cms_rt=;/);
    expect((await http.post('/api/admin/auth/logout').set('X-CMS-CSRF', '1')).status).toBe(204);
  });

  it('FR-AUDIT-05: audit list and CSV export accept date filters', async () => {
    const from = new Date(Date.UTC(2020, 0, 1)).toISOString();
    const to = new Date(Date.UTC(2100, 0, 1)).toISOString();
    const list = await http.get(`/api/admin/audit?from=${from}&to=${to}&page=1&page_size=5`).set(as('ada'));
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    const csv = await http.get(`/api/admin/audit/export.csv?from=${from}&to=${to}`).set(as('ada'));
    expect(csv.text.split('\r\n').length).toBeGreaterThan(2);
  });

  it('FR-PUBAPI-02: API keys can be listed and revoked', async () => {
    const created = await http.post('/api/admin/api-keys').set(as('ada')).send({ name: 'Temp' });
    const keys = await http.get('/api/admin/api-keys').set(as('ada'));
    expect(keys.body.data.map((k: { id: string }) => k.id)).toContain(created.body.id);
    expect((await http.delete(`/api/admin/api-keys/${created.body.id as string}`).set(as('ada'))).status).toBe(204);
  });

  it('FR-MEDIA-02/03/06: get, update, list with filters, delete (force) and serve dev objects', async () => {
    const id = await uploadImage('al', null);
    const got = await http.get(`/api/admin/media/${id}`).set(as('al'));
    expect(got.status).toBe(200);
    expect(
      (await http.patch(`/api/admin/media/${id}`).set(as('al')).send({ altText: 'Described', caption: 'Cap' })).body
        .altText,
    ).toBe('Described');

    const from = new Date(Date.UTC(2020, 0, 1)).toISOString();
    const to = new Date(Date.UTC(2100, 0, 1)).toISOString();
    const list = await http
      .get(`/api/admin/media?search=p.png&kind=image&from=${from}&to=${to}&page=1&page_size=5`)
      .set(as('al'));
    expect((await http.get('/api/admin/media').set(as('al'))).status).toBe(200);
    expect(list.body.data.map((m: { id: string }) => m.id)).toContain(id);

    const served = await http.get(`/api/dev/storage/${encodeURIComponent(storageKeys.at(-1) ?? '')}`);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['content-security-policy']).toContain('sandbox');
    const untyped = await http.put('/api/dev/storage/untyped-object').send(Buffer.from('raw'));
    expect(untyped.status).toBe(200);
    expect((await http.get('/api/dev/storage/missing-object')).status).toBe(404);

    expect((await http.delete(`/api/admin/media/${id}?force=true`).set(as('ada'))).status).toBe(204);
  });

  it('FR-PUBAPI-03/05: published pages and media with featured images, conditional requests and validation', async () => {
    const imageId = await uploadImage('eve');
    const pageId = (
      await http
        .post('/api/admin/content')
        .set(as('eve'))
        .send({
          type: 'page',
          title: 'About Us',
          body: doc('About'),
          featuredImageId: imageId,
          socialImageId: imageId,
          seoDescription: 'Who we are',
        })
    ).body.id as string;
    await http.post(`/api/admin/content/${pageId}/submit`).set(as('eve'));
    expect((await http.post(`/api/admin/content/${pageId}/publish`).set(as('eve'))).body.status).toBe('published');

    const key = (await http.post('/api/admin/api-keys').set(as('ada')).send({ name: 'Pages' })).body.key as string;
    const pages = await http.get('/api/v1/pages?page=1&page_size=10').set('X-API-Key', key);
    expect(pages.status).toBe(200);
    expect(pages.body.data[0]).toMatchObject({ slug: 'about-us', type: 'page', featured_image: { id: imageId } });
    expect(pages.headers['last-modified']).toBeDefined();
    expect(
      (
        await http
          .get('/api/v1/pages?page=1&page_size=10')
          .set('X-API-Key', key)
          .set('If-None-Match', String(pages.headers['etag']))
      ).status,
    ).toBe(304);

    const detail = await http.get('/api/v1/pages/about-us').set('X-API-Key', key);
    expect(detail.body.data.seo).toMatchObject({ description: 'Who we are', social_image: { id: imageId } });
    expect((await http.get('/api/v1/pages/Not_A_Slug').set('X-API-Key', key)).status).toBe(422);

    const media = await http.get(`/api/v1/media/${imageId}`).set('X-API-Key', key);
    expect(media.status).toBe(200);
    expect(media.body.data.id).toBe(imageId);
    expect(media.headers['last-modified']).toBeUndefined();
    expect((await http.get('/api/v1/media/00000000-0000-4000-8000-000000000999').set('X-API-Key', key)).status).toBe(
      404,
    );
    expect((await http.get('/api/v1/articles?page=99').set('X-API-Key', key)).body.data).toEqual([]);
  });

  it('NFR-AVAIL-05: readiness reports degraded dependencies with 503', async () => {
    readinessChecks['database'] = () => Promise.resolve();
    readinessChecks['redis'] = () => Promise.reject(new Error('down'));
    const res = await http.get('/readyz');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', checks: { database: 'ok', redis: 'down' } });
    delete readinessChecks['redis'];
    expect((await http.get('/readyz')).body).toEqual({ status: 'ok', checks: { database: 'ok' } });
    delete readinessChecks['database'];
  });

  it('NFR-OBS-04: unexpected errors become an opaque 500 and are logged with the route', async () => {
    const original = t.app.content.stats.execute.bind(t.app.content.stats);
    t.app.content.stats.execute = () => Promise.reject(new Error('db password is hunter2'));
    try {
      const res = await http.get('/api/admin/content/stats').set(as('eve'));
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
      const logged = t.logger.errors.find((e) => e.msg === 'unhandled error');
      expect(logged?.ctx).toMatchObject({ route: '/api/admin/content/stats' });
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- verifies non-Error throwables are logged safely
      t.app.content.stats.execute = () => Promise.reject('a thrown string');
      expect((await http.get('/api/admin/content/stats').set(as('eve'))).status).toBe(500);
      expect(t.logger.errors.at(-1)?.ctx).toMatchObject({ error: 'a thrown string' });
    } finally {
      t.app.content.stats.execute = original;
    }
  });

  it('FR-PUBAPI-03: deleted media and removed authors degrade gracefully in public responses', async () => {
    const writer = t.seedUser('author', 'Temp Writer', 'temp@example.com');
    tokens['temp'] = (await login('temp@example.com')).body.accessToken as string;
    const imageId = await uploadImage('temp');
    const id = (
      await http
        .post('/api/admin/content')
        .set(as('temp'))
        .send({ type: 'article', title: 'Orphaned', body: doc('x'), featuredImageId: imageId, socialImageId: imageId })
    ).body.id as string;
    await http.post(`/api/admin/content/${id}/submit`).set(as('temp'));
    await http.post(`/api/admin/content/${id}/publish`).set(as('eve'));
    expect((await http.delete(`/api/admin/media/${imageId}?force=true`).set(as('ada'))).status).toBe(204);
    t.infra.db.users.delete(writer.userId);

    const key = (await http.post('/api/admin/api-keys').set(as('ada')).send({ name: 'Orphans' })).body.key as string;
    const detail = await http.get('/api/v1/articles/orphaned').set('X-API-Key', key);
    expect(detail.body.data).toMatchObject({
      author: { name: 'Unknown' },
      featured_image: null,
      seo: { social_image: null },
    });
  });
});

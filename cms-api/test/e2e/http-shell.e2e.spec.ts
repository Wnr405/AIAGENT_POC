import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpApp } from '../../src/composition/http-app';
import type { HttpRuntime } from '../../src/shared/http/runtime';
import { createTestApp } from '../support/test-app';

/** Production-style HTTP shell options: behind a TLS proxy, explicit CORS allow-list, no dev storage. */
const runtime: HttpRuntime = {
  persistence: 'postgres',
  version: 'test',
  readinessChecks: {},
  refreshCookie: { name: 'cms_rt', secure: true, path: '/api/admin/auth' },
  rateLimits: {
    login: { limit: 10, windowSeconds: 60 },
    password_reset: { limit: 5, windowSeconds: 3600 },
    public_api: { limit: 60, windowSeconds: 60 },
    admin_mutation: { limit: 100, windowSeconds: 60 },
  },
};

describe('HTTP shell options (SEC-02, 07-OPS-ARCH §6)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const t = createTestApp();
    app = await createHttpApp(t.app, runtime, {
      corsOrigins: ['https://cms.example.com'],
      bodyLimitMb: 1,
      trustProxy: true,
      devUploadLimitMb: 1,
    });
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends HSTS when the proxy reports HTTPS (trust proxy) and never registers the dev storage stand-in', async () => {
    const res = await http.get('/healthz').set('X-Forwarded-Proto', 'https');
    expect(res.headers['strict-transport-security']).toContain('max-age=63072000');
    expect((await http.get('/healthz')).headers['strict-transport-security']).toBeUndefined();
    expect((await http.put('/api/dev/storage/x').send('data')).status).toBe(404);
  });

  it('allows only configured CORS origins, with credentials', async () => {
    const ok = await http
      .options('/api/admin/auth/login')
      .set('Origin', 'https://cms.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(ok.headers['access-control-allow-origin']).toBe('https://cms.example.com');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const other = await http
      .options('/api/admin/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

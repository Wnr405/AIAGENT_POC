import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './openapi';

type Operation = { security?: Record<string, string[]>[]; tags?: string[] };
const doc = buildOpenApiDocument('1.0.0');
const operations = Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
  Object.entries(item as Record<string, Operation>).map(([method, op]) => ({ route: `${method} ${path}`, path, op })),
);
const schemesOf = (op: Operation) => (op.security ?? []).flatMap((s) => Object.keys(s));

/** Auth endpoints reachable before a session exists (02-SRS §7.2). */
const UNAUTHENTICATED = new Set([
  'post /api/admin/auth/login',
  'post /api/admin/auth/refresh',
  'post /api/admin/auth/logout',
  'post /api/admin/auth/password/forgot',
  'post /api/admin/auth/password/reset',
  'post /api/admin/auth/invite/accept',
]);

describe('OpenAPI document (FR-PUBAPI-07)', () => {
  it('FR-PUBAPI-07: the committed openapi.json is exactly what the Zod schemas generate', () => {
    const committed = readFileSync(join(__dirname, '../../openapi.json'), 'utf8').replace(/\r\n/g, '\n');
    expect(committed).toBe(`${JSON.stringify(doc, null, 2)}\n`);
  });

  it('FR-PUBAPI-07: every admin route except the pre-session auth endpoints documents bearerAuth', () => {
    const admin = operations.filter(({ path }) => path.startsWith('/api/admin/'));
    const wrong = admin.filter(({ route, op }) => {
      const schemes = schemesOf(op);
      return UNAUTHENTICATED.has(route) ? schemes.length > 0 : schemes.join() !== 'bearerAuth';
    });
    expect(admin.length).toBeGreaterThan(UNAUTHENTICATED.size);
    expect(wrong.map(({ route }) => route)).toEqual([]);
  });

  it('FR-PUBAPI-07: every public (/api/v1) route documents the X-API-Key scheme only', () => {
    const pub = operations.filter(({ path }) => !path.startsWith('/api/admin/'));
    expect(pub.every(({ path }) => path.startsWith('/api/v1/'))).toBe(true);
    expect(pub.length).toBeGreaterThan(0);
    expect(pub.filter(({ op }) => schemesOf(op).join() !== 'apiKey').map(({ route }) => route)).toEqual([]);
  });

  it('FR-PUBAPI-07: Auth, Users and Content routes keep their tags after the registration split', () => {
    const tagOf = (prefix: string) => [
      ...new Set(operations.filter(({ path }) => path.startsWith(prefix)).flatMap(({ op }) => op.tags ?? [])),
    ];
    expect(tagOf('/api/admin/auth/')).toEqual(['Auth']);
    expect(tagOf('/api/admin/users')).toEqual(['Users']);
    expect(tagOf('/api/admin/content')).toEqual(['Content']);
  });
});

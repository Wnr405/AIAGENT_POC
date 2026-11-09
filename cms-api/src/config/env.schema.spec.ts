import { describe, expect, it, vi } from 'vitest';
import { envSchema, loadEnv } from './env.schema';
import { settingsFromEnv } from './settings';

const base = {
  PUBLIC_URL: 'https://cms.example.com/',
  API_PUBLIC_URL: 'https://cms.example.com/api',
  JWT_SECRET: 'x'.repeat(64),
  PERSISTENCE: 'memory',
  NODE_ENV: 'development',
};

describe('env schema (07-OPS-ARCH §7.3)', () => {
  it('applies defaults and parses durations, booleans and lists', () => {
    const env = envSchema.parse({
      ...base,
      JWT_ACCESS_TTL: '30m',
      TRUST_PROXY: 'true',
      CORS_ALLOWED_ORIGINS: 'https://a.com, https://b.com,',
    });
    expect([env.JWT_ACCESS_TTL, env.JWT_REFRESH_TTL, env.TRUST_PROXY, env.CORS_ALLOWED_ORIGINS, env.HTTP_PORT]).toEqual(
      [1800, 14 * 86400, true, ['https://a.com', 'https://b.com'], 3000],
    );
  });

  it('requires infrastructure settings for postgres persistence', () => {
    const r = envSchema.safeParse({ ...base, PERSISTENCE: 'postgres' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      'DATABASE_URL',
      'OBJECT_STORAGE_ACCESS_KEY',
      'OBJECT_STORAGE_SECRET_KEY',
      'REDIS_URL',
    ]);
  });

  it('refuses unsafe production configurations', () => {
    const r = envSchema.safeParse({ ...base, NODE_ENV: 'production', JWT_ACCESS_TTL: '2h', JWT_REFRESH_TTL: '30d' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      'EMAIL_PROVIDER',
      'JWT_ACCESS_TTL',
      'JWT_REFRESH_TTL',
      'PERSISTENCE',
    ]);
  });

  it('rejects short JWT secrets and SMTP without host', () => {
    expect(envSchema.safeParse({ ...base, JWT_SECRET: 'short' }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, EMAIL_PROVIDER: 'smtp' }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, JWT_ACCESS_TTL: '15x' }).success).toBe(false);
  });

  it('maps env to application settings', () => {
    const s = settingsFromEnv(envSchema.parse({ ...base, MEDIA_MAX_UPLOAD_MB: '5', CONTENT_CATEGORIES: 'A,B' }));
    expect(s).toMatchObject({
      publicUrl: 'https://cms.example.com',
      maxUploadBytes: 5 * 1048576,
      categories: ['A', 'B'],
      accessTokenTtlSeconds: 900,
    });
  });

  it('loadEnv returns the parsed env, or reports every problem by name (never values) and exits 1', () => {
    expect(loadEnv({ ...base }).PERSISTENCE).toBe('memory');
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    loadEnv({ ...base, JWT_SECRET: 'short-secret-value' });
    expect(exit).toHaveBeenCalledWith(1);
    const output = stderr.mock.calls.map((c) => String(c[0])).join('');
    expect(output).toContain('JWT_SECRET');
    expect(output).not.toContain('short-secret-value');
    loadEnv(null as never);
    expect(stderr.mock.calls.map((c) => String(c[0])).join('')).toContain('(root)');
  });
});

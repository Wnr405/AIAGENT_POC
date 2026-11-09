import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../../test/fakes/fake-clock';
import { SilentLogger } from '../../../test/fakes/fakes';
import { CacheRateLimiter } from './cache-rate-limiter';
import { InMemoryCache } from './in-memory-cache';
import { InProcessEventPublisher } from './in-process-event-publisher';
import { NodeSecretGenerator, Sha256TokenHasher, UuidV4Generator } from './node-crypto';
import { NoopTransactionRunner } from './noop-transaction-runner';
import { SystemClock } from './system-clock';
import type { DomainEvent } from '../kernel/domain-event';

const event = (type: string): DomainEvent => ({
  type,
  occurredAt: new Date(0),
  actorId: null,
  actorIp: null,
  target: { type: 't', id: null },
  summary: {},
});

describe('InMemoryCache', () => {
  it('stores values until their TTL elapses', async () => {
    const clock = new FakeClock();
    const cache = new InMemoryCache(clock);
    await cache.set('k', { a: 1 }, 10);
    expect(await cache.get('k')).toEqual({ a: 1 });
    clock.advance(10_000);
    expect(await cache.get('k')).toBeUndefined();
  });

  it('deletes keys', async () => {
    const cache = new InMemoryCache(new FakeClock());
    await cache.set('k', 1, 10);
    await cache.delete('k');
    expect(await cache.get('k')).toBeUndefined();
  });

  it('increments counters and restarts them after expiry', async () => {
    const clock = new FakeClock();
    const cache = new InMemoryCache(clock);
    expect(await cache.increment('c', 5)).toBe(1);
    expect(await cache.increment('c', 5)).toBe(2);
    clock.advance(5_000);
    expect(await cache.increment('c', 5)).toBe(1);
  });
});

describe('CacheRateLimiter (SEC-07)', () => {
  it('allows up to the limit per window, then reports retry-after', async () => {
    const clock = new FakeClock('2026-05-01T00:00:00Z');
    const limiter = new CacheRateLimiter(new InMemoryCache(clock), clock);
    for (let i = 0; i < 10; i++) expect((await limiter.hit('login:1.2.3.4', 10, 60)).allowed).toBe(true);
    clock.advance(15_000);
    const blocked = await limiter.hit('login:1.2.3.4', 10, 60);
    expect(blocked).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 45 });
    clock.advance(45_000);
    expect(await limiter.hit('login:1.2.3.4', 10, 60)).toEqual({ allowed: true, remaining: 9, retryAfterSeconds: 0 });
  });
});

describe('InProcessEventPublisher', () => {
  it('delivers to type subscribers and wildcard subscribers in order', async () => {
    const pub = new InProcessEventPublisher(new SilentLogger());
    const seen: string[] = [];
    pub.subscribe('a', (e) => {
      seen.push(`a:${e.type}`);
      return Promise.resolve();
    });
    pub.subscribe('*', (e) => {
      seen.push(`*:${e.type}`);
      return Promise.resolve();
    });
    await pub.publishAll([event('a'), event('b')]);
    expect(seen).toEqual(['a:a', '*:a', '*:b']);
  });

  it('logs a failing handler and keeps delivering', async () => {
    const logger = new SilentLogger();
    const pub = new InProcessEventPublisher(logger);
    const seen: string[] = [];
    pub.subscribe('a', () => Promise.reject(new Error('boom')));
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- verifies non-Error rejections are logged too
    pub.subscribe('a', () => Promise.reject('plain'));
    pub.subscribe('a', () => {
      seen.push('ok');
      return Promise.resolve();
    });
    await pub.publishAll([event('a')]);
    expect(seen).toEqual(['ok']);
    expect(logger.errors.map((e) => e.ctx?.['error'])).toEqual(['boom', 'plain']);
  });
});

describe('crypto + clock adapters', () => {
  it('generates distinct UUID v4 ids', () => {
    const g = new UuidV4Generator();
    const a = g.next();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(g.next()).not.toBe(a);
  });

  it('generates url-safe secrets of the requested entropy', () => {
    const s = new NodeSecretGenerator().generate(32);
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes tokens deterministically with SHA-256', () => {
    const h = new Sha256TokenHasher();
    expect(h.hash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('system clock returns the current time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
  });

  it('noop transaction runner just runs the work', async () => {
    expect(await new NoopTransactionRunner().run(() => Promise.resolve(7))).toBe(7);
  });
});

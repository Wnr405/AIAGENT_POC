import type { Redis } from 'ioredis';
import type { Cache } from '../ports/cache.port';

/** Shared cache + counters (rate limits) across API instances. Values are JSON. */
export class RedisCacheAdapter implements Cache {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'cms:',
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(this.prefix + key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.prefix + key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.prefix + key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const k = this.prefix + key;
    const [[, count]] = (await this.redis.multi().incr(k).expire(k, ttlSeconds, 'NX').exec()) as [
      [Error | null, number],
    ];
    return count;
  }
}

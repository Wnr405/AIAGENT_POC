import type { Cache } from '../ports/cache.port';
import type { Clock } from '../ports/clock.port';
import type { RateLimitDecision, RateLimiter } from '../ports/rate-limiter.port';

/** Fixed-window rate limiter on top of any Cache (Redis in prod → shared across instances). */
export class CacheRateLimiter implements RateLimiter {
  constructor(
    private readonly cache: Cache,
    private readonly clock: Clock,
  ) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const nowSec = Math.floor(this.clock.now().getTime() / 1000);
    const windowStart = nowSec - (nowSec % windowSeconds);
    const count = await this.cache.increment(`rl:${key}:${windowStart}`, windowSeconds);
    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: allowed ? 0 : windowStart + windowSeconds - nowSec,
    };
  }
}

import type { RateLimitBucket } from './decorators';

/** HTTP-only runtime settings derived from env (kept out of the domain). */
export interface HttpRuntime {
  readonly rateLimits: Record<RateLimitBucket, { limit: number; windowSeconds: number }>;
  readonly refreshCookie: { name: string; secure: boolean; path: string };
  readonly persistence: 'postgres' | 'memory';
  readonly version: string;
  readonly readinessChecks: Record<string, () => Promise<void>>;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Fixed-window limiter: at most `limit` hits per `windowSeconds` per key. */
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Atomically increment an integer counter, creating it with the TTL if absent. */
  increment(key: string, ttlSeconds: number): Promise<number>;
}

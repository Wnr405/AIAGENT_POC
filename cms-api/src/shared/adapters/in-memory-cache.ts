import type { Cache } from '../ports/cache.port';
import type { Clock } from '../ports/clock.port';

interface Entry {
  value: unknown;
  expiresAt: number;
}

/** Single-process cache. Used in tests and `PERSISTENCE=memory` dev mode. */
export class InMemoryCache implements Cache {
  private readonly store = new Map<string, Entry>();

  constructor(private readonly clock: Clock) {}

  private live(key: string): Entry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.clock.now().getTime()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  get<T>(key: string): Promise<T | undefined> {
    return Promise.resolve(this.live(key)?.value as T | undefined);
  }

  set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: this.clock.now().getTime() + ttlSeconds * 1000 });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  increment(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.live(key);
    if (!entry) {
      this.store.set(key, { value: 1, expiresAt: this.clock.now().getTime() + ttlSeconds * 1000 });
      return Promise.resolve(1);
    }
    entry.value = (entry.value as number) + 1;
    return Promise.resolve(entry.value as number);
  }
}

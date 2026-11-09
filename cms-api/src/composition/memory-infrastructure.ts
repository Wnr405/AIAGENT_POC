import { CacheRateLimiter } from '../shared/adapters/cache-rate-limiter';
import { InMemoryCache } from '../shared/adapters/in-memory-cache';
import { InProcessEventPublisher } from '../shared/adapters/in-process-event-publisher';
import { MemoryDb } from '../shared/adapters/memory/memory-db';
import { NodeSecretGenerator, Sha256TokenHasher, UuidV4Generator } from '../shared/adapters/node-crypto';
import { NoopTransactionRunner } from '../shared/adapters/noop-transaction-runner';
import { SystemClock } from '../shared/adapters/system-clock';
import { InMemoryAuditEventRepository } from '../modules/audit/adapters/out/persistence/in-memory-audit.repository';
import {
  InMemoryApiKeyRepository,
  InMemoryAuthAccountRepository,
  InMemoryOneTimeTokenRepository,
  InMemoryRefreshTokenRepository,
} from '../modules/auth/adapters/out/persistence/in-memory-auth.repositories';
import {
  InMemoryContentRepository,
  InMemoryContentVersionRepository,
} from '../modules/content/adapters/out/persistence/in-memory-content.repositories';
import { InMemoryMediaRepository } from '../modules/media/adapters/out/persistence/in-memory-media.repository';
import { InMemoryObjectStorage } from '../modules/media/adapters/out/storage/in-memory-object-storage';
import { InMemoryUserRepository } from '../modules/users/adapters/out/persistence/in-memory-user.repository';
import type { Infrastructure } from './infrastructure';

type Required = Pick<Infrastructure, 'passwordHasher' | 'tokenSigner' | 'emailSender' | 'images' | 'logger' | 'jobs'>;
type Optional = Partial<Omit<Infrastructure, keyof Required | 'repos'>>;

/**
 * Fully in-memory infrastructure: no Postgres, Redis or S3. Used by tests and
 * by `PERSISTENCE=memory` for demos. Crypto-dependent adapters are injected so
 * tests can use fast fakes and the dev server real Argon2/JWT.
 */
export function buildMemoryInfrastructure(
  required: Required,
  optional: Optional & { baseUrl?: string } = {},
): Infrastructure & { db: MemoryDb; storage: InMemoryObjectStorage } {
  const db = new MemoryDb();
  const { baseUrl, ...overrides } = optional;
  const clock = optional.clock ?? new SystemClock();
  const cache = optional.cache ?? new InMemoryCache(clock);
  const storage = new InMemoryObjectStorage(baseUrl ?? 'http://localhost:3000');
  const defaults = {
    ids: new UuidV4Generator(),
    secrets: new NodeSecretGenerator(),
    tokenHasher: new Sha256TokenHasher(),
    rateLimiter: new CacheRateLimiter(cache, clock),
    tx: new NoopTransactionRunner(),
    events: new InProcessEventPublisher(required.logger),
  };
  const provided = Object.fromEntries(
    Object.entries(overrides as Record<string, unknown>).filter(([, v]) => v !== undefined),
  ) as Optional;
  return {
    ...required,
    ...defaults,
    ...provided,
    db,
    clock,
    cache,
    storage,
    repos: {
      users: new InMemoryUserRepository(db),
      authAccounts: new InMemoryAuthAccountRepository(db),
      refreshTokens: new InMemoryRefreshTokenRepository(db),
      oneTimeTokens: new InMemoryOneTimeTokenRepository(db),
      apiKeys: new InMemoryApiKeyRepository(db),
      contents: new InMemoryContentRepository(db),
      versions: new InMemoryContentVersionRepository(db),
      media: new InMemoryMediaRepository(db),
      audit: new InMemoryAuditEventRepository(db),
    },
  };
}

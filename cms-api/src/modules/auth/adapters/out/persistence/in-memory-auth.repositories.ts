import type { MemoryDb } from '../../../../../shared/adapters/memory/memory-db';
import { ApiKey, type ApiKeyProps } from '../../../domain/api-key.entity';
import { AuthAccount } from '../../../domain/auth-account.entity';
import { OneTimeToken, type OneTimeTokenProps, type OneTimeTokenPurpose } from '../../../domain/one-time-token.entity';
import { RefreshToken, type RefreshTokenProps } from '../../../domain/refresh-token.entity';
import type {
  ApiKeyRepository,
  AuthAccountRepository,
  OneTimeTokenRepository,
  RefreshTokenRepository,
} from '../../../application/ports/out/auth-repositories.port';

export class InMemoryAuthAccountRepository implements AuthAccountRepository {
  constructor(private readonly db: MemoryDb) {}

  private toDomain(id: string): AuthAccount | null {
    const r = this.db.users.get(id);
    if (!r) return null;
    return AuthAccount.rehydrate({
      userId: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      status: r.status,
      passwordHash: r.passwordHash,
      failedLoginCount: r.failedLoginCount,
      failedWindowStartedAt: r.failedWindowStartedAt,
      lockedUntil: r.lockedUntil,
      lastLoginAt: r.lastLoginAt,
    });
  }

  findByEmail(email: string): Promise<AuthAccount | null> {
    const r = [...this.db.users.values()].find((u) => u.email === email);
    return Promise.resolve(r ? this.toDomain(r.id) : null);
  }

  findById(userId: string): Promise<AuthAccount | null> {
    return Promise.resolve(this.toDomain(userId));
  }

  /** Writes only credential columns — profile columns belong to the users module. */
  save(account: AuthAccount): Promise<void> {
    const p = account.toProps();
    const r = this.db.users.get(p.userId);
    if (r) {
      Object.assign(r, {
        status: p.status,
        passwordHash: p.passwordHash,
        failedLoginCount: p.failedLoginCount,
        failedWindowStartedAt: p.failedWindowStartedAt,
        lockedUntil: p.lockedUntil,
        lastLoginAt: p.lastLoginAt,
      });
    }
    return Promise.resolve();
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: MemoryDb) {}
  private get t(): Map<string, RefreshTokenProps> {
    return this.db.table<RefreshTokenProps>('refresh_tokens');
  }

  save(token: RefreshToken): Promise<void> {
    this.t.set(token.id, { ...token.toProps() });
    return Promise.resolve();
  }

  findByHash(hash: string): Promise<RefreshToken | null> {
    const p = [...this.t.values()].find((x) => x.tokenHash === hash);
    return Promise.resolve(p ? RefreshToken.rehydrate(p) : null);
  }

  revokeFamily(familyId: string, now: Date): Promise<void> {
    for (const p of this.t.values()) if (p.familyId === familyId && p.revokedAt === null) p.revokedAt = now;
    return Promise.resolve();
  }

  revokeAllForUser(userId: string, now: Date): Promise<void> {
    for (const p of this.t.values()) if (p.userId === userId && p.revokedAt === null) p.revokedAt = now;
    return Promise.resolve();
  }
}

export class InMemoryOneTimeTokenRepository implements OneTimeTokenRepository {
  constructor(private readonly db: MemoryDb) {}
  private get t(): Map<string, OneTimeTokenProps> {
    return this.db.table<OneTimeTokenProps>('one_time_tokens');
  }

  save(token: OneTimeToken): Promise<void> {
    this.t.set(token.id, { ...token.toProps() });
    return Promise.resolve();
  }

  findByHash(hash: string): Promise<OneTimeToken | null> {
    const p = [...this.t.values()].find((x) => x.tokenHash === hash);
    return Promise.resolve(p ? OneTimeToken.rehydrate(p) : null);
  }

  invalidateAll(userId: string, purpose: OneTimeTokenPurpose, now: Date): Promise<void> {
    for (const p of this.t.values()) {
      if (p.userId === userId && p.purpose === purpose && p.usedAt === null) p.usedAt = now;
    }
    return Promise.resolve();
  }
}

export class InMemoryApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly db: MemoryDb) {}
  private get t(): Map<string, ApiKeyProps> {
    return this.db.table<ApiKeyProps>('api_keys');
  }

  save(key: ApiKey): Promise<void> {
    this.t.set(key.id, { ...key.toProps() });
    return Promise.resolve();
  }

  findById(id: string): Promise<ApiKey | null> {
    const p = this.t.get(id);
    return Promise.resolve(p ? ApiKey.rehydrate(p) : null);
  }

  findByHash(hash: string): Promise<ApiKey | null> {
    const p = [...this.t.values()].find((x) => x.keyHash === hash);
    return Promise.resolve(p ? ApiKey.rehydrate(p) : null);
  }

  list(): Promise<ApiKey[]> {
    return Promise.resolve(
      [...this.t.values()]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((row) => ApiKey.rehydrate(row)),
    );
  }
}

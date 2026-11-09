import type { PrismaContext } from '../../../../../shared/adapters/prisma/prisma-context';
import { ApiKey } from '../../../domain/api-key.entity';
import { AuthAccount } from '../../../domain/auth-account.entity';
import { OneTimeToken, type OneTimeTokenPurpose } from '../../../domain/one-time-token.entity';
import { RefreshToken } from '../../../domain/refresh-token.entity';
import type {
  ApiKeyRepository,
  AuthAccountRepository,
  OneTimeTokenRepository,
  RefreshTokenRepository,
} from '../../../application/ports/out/auth-repositories.port';
import type { User as UserRow } from '@prisma/client';

const toAccount = (r: UserRow): AuthAccount =>
  AuthAccount.rehydrate({
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

export class PrismaAuthAccountRepository implements AuthAccountRepository {
  constructor(private readonly ctx: PrismaContext) {}

  async findByEmail(email: string): Promise<AuthAccount | null> {
    const r = await this.ctx.db.user.findUnique({ where: { email } });
    return r ? toAccount(r) : null;
  }

  async findById(userId: string): Promise<AuthAccount | null> {
    const r = await this.ctx.db.user.findUnique({ where: { id: userId } });
    return r ? toAccount(r) : null;
  }

  /** Only credential/lockout columns — the profile belongs to the users module. */
  async save(account: AuthAccount): Promise<void> {
    const p = account.toProps();
    await this.ctx.db.user.update({
      where: { id: p.userId },
      data: {
        status: p.status,
        passwordHash: p.passwordHash,
        failedLoginCount: p.failedLoginCount,
        failedWindowStartedAt: p.failedWindowStartedAt,
        lockedUntil: p.lockedUntil,
        lastLoginAt: p.lastLoginAt,
      },
    });
  }
}

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly ctx: PrismaContext) {}

  async save(token: RefreshToken): Promise<void> {
    const p = token.toProps();
    await this.ctx.db.refreshToken.upsert({ where: { id: p.id }, create: p, update: p });
  }

  async findByHash(hash: string): Promise<RefreshToken | null> {
    const r = await this.ctx.db.refreshToken.findUnique({ where: { tokenHash: hash } });
    return r ? RefreshToken.rehydrate(r) : null;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.ctx.db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await this.ctx.db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  }
}

export class PrismaOneTimeTokenRepository implements OneTimeTokenRepository {
  constructor(private readonly ctx: PrismaContext) {}

  async save(token: OneTimeToken): Promise<void> {
    const p = token.toProps();
    await this.ctx.db.oneTimeToken.upsert({ where: { id: p.id }, create: p, update: p });
  }

  async findByHash(hash: string): Promise<OneTimeToken | null> {
    const r = await this.ctx.db.oneTimeToken.findUnique({ where: { tokenHash: hash } });
    return r ? OneTimeToken.rehydrate(r) : null;
  }

  async invalidateAll(userId: string, purpose: OneTimeTokenPurpose, now: Date): Promise<void> {
    await this.ctx.db.oneTimeToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } });
  }
}

export class PrismaApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly ctx: PrismaContext) {}

  async save(key: ApiKey): Promise<void> {
    const p = key.toProps();
    await this.ctx.db.apiKey.upsert({ where: { id: p.id }, create: p, update: p });
  }

  async findById(id: string): Promise<ApiKey | null> {
    const r = await this.ctx.db.apiKey.findUnique({ where: { id } });
    return r ? ApiKey.rehydrate(r) : null;
  }

  async findByHash(hash: string): Promise<ApiKey | null> {
    const r = await this.ctx.db.apiKey.findUnique({ where: { keyHash: hash } });
    return r ? ApiKey.rehydrate(r) : null;
  }

  async list(): Promise<ApiKey[]> {
    const rows = await this.ctx.db.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ApiKey.rehydrate(r));
  }
}

import { Email } from '../../../../shared/kernel/email.vo';
import { UnauthorizedError } from '../../../../shared/kernel/errors';
import type { DomainEvent } from '../../../../shared/kernel/domain-event';
import type { AuthAccount } from '../../domain/auth-account.entity';
import { RefreshToken } from '../../domain/refresh-token.entity';
import type {
  AuthenticateAccessTokenUseCase,
  LoginUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
  RequestMeta,
  RevokeUserSessionsUseCase,
  SessionTokens,
} from '../ports/in/auth.ports';
import type { AuthDeps } from './auth-deps';

/** One generic message for every login failure — never reveal lockout/existence (FR-AUTH-06). */
export const INVALID_CREDENTIALS = 'Invalid email or password';

/** Hash used to equalise timing when the email does not exist. */
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXlzYWx0ZHVtbXk$Vw4BTUUZFvCqJk2pWw3RkzgKxV9uTWB3S4lsWv7c0BE';

interface AuthEventInput {
  readonly now: Date;
  readonly meta: RequestMeta;
  readonly userId: string | null;
}

function authEvent(
  type: string,
  { now, meta, userId }: AuthEventInput,
  summary: Record<string, unknown> = {},
): DomainEvent {
  return {
    type,
    occurredAt: now,
    actorId: userId,
    actorIp: meta.ip,
    target: { type: 'user', id: userId },
    summary,
  };
}

/** Creates an access token + a fresh refresh token (new or existing family). */
export async function issueSession(
  d: AuthDeps,
  account: AuthAccount,
  familyId: string,
): Promise<{ tokens: SessionTokens; refresh: RefreshToken }> {
  const now = d.clock.now();
  const raw = d.secrets.generate(32);
  const refresh = RefreshToken.issue({
    id: d.ids.next(),
    userId: account.userId,
    familyId,
    tokenHash: d.tokenHasher.hash(raw),
    issuedAt: now,
    expiresAt: new Date(now.getTime() + d.settings.refreshTokenTtlSeconds * 1000),
  });
  const accessToken = await d.signer.sign(
    { sub: account.userId, role: account.role },
    d.settings.accessTokenTtlSeconds,
  );
  return {
    refresh,
    tokens: {
      accessToken,
      accessTokenExpiresIn: d.settings.accessTokenTtlSeconds,
      refreshToken: raw,
      refreshTokenExpiresAt: refresh.expiresAt,
      user: { id: account.userId, email: account.email, name: account.name, role: account.role },
    },
  };
}

function normalizeEmail(input: string): string | null {
  try {
    return Email.create(input).value;
  } catch {
    return null;
  }
}

/** FR-AUTH-01/04/06/10. CRITICAL PATH. */
export class Login implements LoginUseCase {
  constructor(private readonly d: AuthDeps) {}

  async execute(cmd: { email: string; password: string }, meta: RequestMeta): Promise<SessionTokens> {
    const now = this.d.clock.now();
    const email = normalizeEmail(cmd.email);
    const account = email === null ? null : await this.d.accounts.findByEmail(email);

    if (!account) {
      await this.d.hasher.verify(DUMMY_HASH, cmd.password); // timing equalisation
      throw await this.reject(now, meta, null, 'unknown_email');
    }
    const acc = account;

    const hash = acc.loginHashAt(now);
    if (hash === null) {
      throw await this.reject(now, meta, acc.userId, acc.isLockedAt(now) ? 'locked' : `status_${acc.status}`);
    }

    const ok = await this.d.hasher.verify(hash, cmd.password);
    if (!ok) {
      const lockedNow = acc.registerFailedLogin(now);
      await this.d.accounts.save(acc);
      throw await this.reject(now, meta, acc.userId, lockedNow ? 'bad_password_locked' : 'bad_password');
    }

    acc.registerSuccessfulLogin(now);
    await this.d.accounts.save(acc);
    const { tokens, refresh } = await issueSession(this.d, acc, this.d.ids.next());
    await this.d.refreshTokens.save(refresh);
    await this.d.events.publishAll([authEvent('auth.login', { now, meta, userId: acc.userId })]);
    return tokens;
  }

  private async reject(
    now: Date,
    meta: RequestMeta,
    userId: string | null,
    reason: string,
  ): Promise<UnauthorizedError> {
    await this.d.events.publishAll([authEvent('auth.login_failed', { now, meta, userId }, { reason })]);
    return new UnauthorizedError(INVALID_CREDENTIALS);
  }
}

/** Refresh rotation + reuse detection (ADR-0010, FR-AUTH-04/05). CRITICAL PATH. */
export class RefreshSession implements RefreshSessionUseCase {
  constructor(private readonly d: AuthDeps) {}

  async execute(rawToken: string, meta: RequestMeta): Promise<SessionTokens> {
    const now = this.d.clock.now();
    const current = await this.d.refreshTokens.findByHash(this.d.tokenHasher.hash(rawToken));
    if (!current) throw new UnauthorizedError('Session expired');

    if (current.wasRotated()) {
      await this.d.refreshTokens.revokeFamily(current.familyId, now);
      await this.d.events.publishAll([
        authEvent('auth.refresh_reuse_detected', { now, meta, userId: current.userId }, { familyId: current.familyId }),
      ]);
      throw new UnauthorizedError('Session expired');
    }
    if (!current.isUsableAt(now)) throw new UnauthorizedError('Session expired');

    const account = await this.d.accounts.findById(current.userId);
    if (!account || account.status !== 'active') {
      current.revoke(now);
      await this.d.refreshTokens.save(current);
      throw new UnauthorizedError('Session expired');
    }

    const { tokens, refresh } = await issueSession(this.d, account, current.familyId);
    current.rotateTo(refresh.id, now);
    await this.d.refreshTokens.save(current);
    await this.d.refreshTokens.save(refresh);
    return tokens;
  }
}

/** FR-AUTH-09. Idempotent: unknown / missing tokens are ignored. */
export class Logout implements LogoutUseCase {
  constructor(private readonly d: AuthDeps) {}

  async execute(rawToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (!rawToken) return;
    const token = await this.d.refreshTokens.findByHash(this.d.tokenHasher.hash(rawToken));
    if (!token) return;
    const now = this.d.clock.now();
    await this.d.refreshTokens.revokeFamily(token.familyId, now);
    await this.d.events.publishAll([authEvent('auth.logout', { now, meta, userId: token.userId })]);
  }
}

/** FR-AUTH-05: called on deactivation and password change. */
export class RevokeUserSessions implements RevokeUserSessionsUseCase {
  constructor(private readonly d: Pick<AuthDeps, 'refreshTokens' | 'clock'>) {}

  async execute(userId: string): Promise<void> {
    await this.d.refreshTokens.revokeAllForUser(userId, this.d.clock.now());
  }
}

/**
 * Verifies the JWT and re-checks the account so deactivation and role changes
 * take effect immediately (FR-USER-05), not after token expiry.
 */
export class AuthenticateAccessToken implements AuthenticateAccessTokenUseCase {
  constructor(private readonly d: Pick<AuthDeps, 'signer' | 'accounts'>) {}

  async execute(token: string): Promise<{ userId: string; role: AuthAccount['role'] }> {
    const claims = await this.d.signer.verify(token);
    if (!claims) throw new UnauthorizedError();
    const account = await this.d.accounts.findById(claims.sub);
    if (!account || account.status !== 'active') throw new UnauthorizedError();
    return { userId: account.userId, role: account.role };
  }
}

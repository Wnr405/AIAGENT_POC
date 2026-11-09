import type { ActorContext } from '../../../../shared/kernel/actor';
import { Email } from '../../../../shared/kernel/email.vo';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../../../shared/kernel/errors';
import type { AuthAccount } from '../../domain/auth-account.entity';
import { OneTimeToken, type OneTimeTokenPurpose } from '../../domain/one-time-token.entity';
import { assertPasswordPolicy } from '../../domain/password-policy';
import type {
  AcceptInviteUseCase,
  ChangeOwnPasswordUseCase,
  CompletePasswordResetUseCase,
  IssueOneTimeTokenUseCase,
  RequestMeta,
  RequestPasswordResetUseCase,
} from '../ports/in/auth.ports';
import type { AuthDeps } from './auth-deps';

const LINK_PATH: Record<OneTimeTokenPurpose, string> = {
  invite: '/accept-invite',
  password_reset: '/reset-password',
};

/** Issues a single-use token and emails the link (FR-USER-02, FR-AUTH-07). */
export class IssueOneTimeToken implements IssueOneTimeTokenUseCase {
  constructor(private readonly d: AuthDeps) {}

  async execute(userId: string, purpose: OneTimeTokenPurpose): Promise<void> {
    const account = await this.d.accounts.findById(userId);
    if (!account) throw new NotFoundError('User', userId);
    const now = this.d.clock.now();
    const raw = this.d.secrets.generate(32);
    await this.d.oneTimeTokens.invalidateAll(userId, purpose, now);
    await this.d.oneTimeTokens.save(
      OneTimeToken.issue({
        id: this.d.ids.next(),
        userId,
        purpose,
        tokenHash: this.d.tokenHasher.hash(raw),
        now,
      }),
    );
    const link = `${this.d.settings.publicUrl}${LINK_PATH[purpose]}?token=${encodeURIComponent(raw)}`;
    const to = { email: account.email, name: account.name };
    if (purpose === 'invite') await this.d.mailer.sendInvite(to, link);
    else await this.d.mailer.sendPasswordReset(to, link);
  }
}

/** FR-AUTH-07. Always succeeds from the caller's view — no account enumeration. */
export class RequestPasswordReset implements RequestPasswordResetUseCase {
  constructor(
    private readonly d: AuthDeps,
    private readonly issue: IssueOneTimeTokenUseCase,
  ) {}

  async execute(email: string, meta: RequestMeta): Promise<void> {
    let normalized: string;
    try {
      normalized = Email.create(email).value;
    } catch {
      return;
    }
    const account = await this.d.accounts.findByEmail(normalized);
    if (!account || account.status !== 'active') return;
    await this.issue.execute(account.userId, 'password_reset');
    await this.d.events.publishAll([
      {
        type: 'auth.password_reset_requested',
        occurredAt: this.d.clock.now(),
        actorId: null,
        actorIp: meta.ip,
        target: { type: 'user', id: account.userId },
        summary: {},
      },
    ]);
  }
}

/** Shared flow for "redeem a one-time token and set a password". CRITICAL PATH. */
interface RedeemPolicy {
  readonly purpose: OneTimeTokenPurpose;
  readonly requiredStatus: AuthAccount['status'];
}

async function redeem(
  d: AuthDeps,
  cmd: { token: string; password: string },
  { purpose, requiredStatus }: RedeemPolicy,
  meta: RequestMeta,
): Promise<void> {
  const { token: rawToken, password } = cmd;
  const now = d.clock.now();
  const token = await d.oneTimeTokens.findByHash(d.tokenHasher.hash(rawToken));
  if (!token || !token.isValidAt(now, purpose)) {
    throw new ValidationError('This link is invalid or has expired', { field: 'token' });
  }
  const account = await d.accounts.findById(token.userId);
  if (!account || account.status !== requiredStatus) {
    throw new ValidationError('This link is invalid or has expired', { field: 'token' });
  }
  assertPasswordPolicy(password);
  account.setPasswordHash(await d.hasher.hash(password));
  token.consume(now);
  await d.accounts.save(account);
  await d.oneTimeTokens.save(token);
  await d.refreshTokens.revokeAllForUser(account.userId, now);
  await d.events.publishAll([
    {
      type: purpose === 'invite' ? 'auth.invite_accepted' : 'auth.password_reset',
      occurredAt: now,
      actorId: account.userId,
      actorIp: meta.ip,
      target: { type: 'user', id: account.userId },
      summary: {},
    },
  ]);
}

/** FR-AUTH-07/08 */
export class CompletePasswordReset implements CompletePasswordResetUseCase {
  constructor(private readonly d: AuthDeps) {}

  execute(cmd: { token: string; password: string }, meta: RequestMeta): Promise<void> {
    return redeem(this.d, cmd, { purpose: 'password_reset', requiredStatus: 'active' }, meta);
  }
}

/** FR-USER-02 */
export class AcceptInvite implements AcceptInviteUseCase {
  constructor(private readonly d: AuthDeps) {}

  execute(cmd: { token: string; password: string }, meta: RequestMeta): Promise<void> {
    return redeem(this.d, cmd, { purpose: 'invite', requiredStatus: 'invited' }, meta);
  }
}

/** Profile → change own password. Revokes all sessions (FR-AUTH-05). */
export class ChangeOwnPassword implements ChangeOwnPasswordUseCase {
  constructor(private readonly d: AuthDeps) {}

  async execute(cmd: { currentPassword: string; newPassword: string }, actor: ActorContext): Promise<void> {
    const account = await this.d.accounts.findById(actor.userId);
    if (!account || account.passwordHash === null) throw new UnauthorizedError();
    if (!(await this.d.hasher.verify(account.passwordHash, cmd.currentPassword))) {
      throw new ValidationError('Current password is incorrect', { field: 'currentPassword' });
    }
    assertPasswordPolicy(cmd.newPassword);
    const now = this.d.clock.now();
    account.setPasswordHash(await this.d.hasher.hash(cmd.newPassword));
    await this.d.accounts.save(account);
    await this.d.refreshTokens.revokeAllForUser(account.userId, now);
    await this.d.events.publishAll([
      {
        type: 'auth.password_change',
        occurredAt: now,
        actorId: actor.userId,
        actorIp: actor.ip,
        target: { type: 'user', id: actor.userId },
        summary: {},
      },
    ]);
  }
}

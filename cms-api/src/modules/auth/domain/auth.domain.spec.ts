import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '../../../shared/kernel/errors';
import { ApiKey } from './api-key.entity';
import { AuthAccount, type AuthAccountProps } from './auth-account.entity';
import { LOCKOUT_POLICY } from './lockout-policy';
import { OneTimeToken, ONE_TIME_TOKEN_TTL_MS } from './one-time-token.entity';
import { assertPasswordPolicy } from './password-policy';
import { RefreshToken, SESSION_IDLE_MS } from './refresh-token.entity';

const T0 = new Date('2026-05-01T09:00:00Z');
const at = (ms: number): Date => new Date(T0.getTime() + ms);
const MIN = 60_000;

function account(overrides: Partial<AuthAccountProps> = {}): AuthAccount {
  return AuthAccount.rehydrate({
    userId: 'u1',
    email: 'a@example.com',
    name: 'A',
    role: 'editor',
    status: 'active',
    passwordHash: 'h',
    failedLoginCount: 0,
    failedWindowStartedAt: null,
    lockedUntil: null,
    lastLoginAt: null,
    ...overrides,
  });
}

describe('password policy (FR-AUTH-02) — critical path', () => {
  it('accepts 12+ chars with a letter and a digit', () => {
    expect(() => assertPasswordPolicy('abcdefghijk1')).not.toThrow();
    expect(() => assertPasswordPolicy('รหัสผ่านยาวมาก12')).not.toThrow(); // non-Latin letters count
  });

  it.each([
    ['abcdefghij1', 'at least 12 characters'],
    ['abcdefghijkl', 'at least one digit'],
    ['123456789012', 'at least one letter'],
    ['a1'.repeat(129), 'at most 256 characters'],
  ])('rejects %s (%s)', (pw: string, reason: string) => {
    expect(() => assertPasswordPolicy(pw)).toThrow(reason);
  });

  it('reports every problem at once with field details', () => {
    try {
      assertPasswordPolicy('');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).message).toBe(
        'Password must contain at least 12 characters, at least one letter, at least one digit',
      );
      expect((e as ValidationError).details).toEqual({ field: 'password' });
    }
  });
});

describe('AuthAccount lockout (FR-AUTH-06) — critical path', () => {
  it('locks for 15 minutes on the 5th failure within 10 minutes', () => {
    const a = account();
    for (let i = 0; i < LOCKOUT_POLICY.maxFailures - 1; i++) expect(a.registerFailedLogin(at(i * MIN))).toBe(false);
    expect(a.registerFailedLogin(at(4 * MIN))).toBe(true);
    expect(a.isLockedAt(at(4 * MIN + 1))).toBe(true);
    expect(a.loginHashAt(at(4 * MIN + 1))).toBeNull();
    expect(a.isLockedAt(at(19 * MIN))).toBe(false);
    expect(a.loginHashAt(at(19 * MIN))).toBe('h');
  });

  it('restarts the window when failures are more than 10 minutes apart', () => {
    const a = account();
    for (let i = 0; i < 4; i++) a.registerFailedLogin(at(i * MIN));
    expect(a.registerFailedLogin(at(14 * MIN))).toBe(false); // window from T0 expired → count resets to 1
    expect(a.toProps().failedLoginCount).toBe(1);
  });

  it('counts a failure exactly 10 minutes after the first as inside the window', () => {
    const a = account();
    for (let i = 0; i < 4; i++) a.registerFailedLogin(at(0));
    expect(a.registerFailedLogin(at(LOCKOUT_POLICY.windowMs))).toBe(true);
  });

  it('successful login clears failures and records last login', () => {
    const a = account({ failedLoginCount: 3, failedWindowStartedAt: T0, lockedUntil: at(-1) });
    a.registerSuccessfulLogin(at(MIN));
    expect(a.toProps()).toMatchObject({
      failedLoginCount: 0,
      failedWindowStartedAt: null,
      lockedUntil: null,
      lastLoginAt: at(MIN),
    });
  });

  it('cannot log in when not active or without a password', () => {
    expect(account({ status: 'deactivated' }).loginHashAt(T0)).toBeNull();
    expect(account({ status: 'invited', passwordHash: null }).loginHashAt(T0)).toBeNull();
  });

  it('setting a password activates invited accounts and clears locks', () => {
    const a = account({
      status: 'invited',
      passwordHash: null,
      lockedUntil: at(MIN),
      failedLoginCount: 2,
      failedWindowStartedAt: T0,
    });
    a.setPasswordHash('new');
    expect(a.toProps()).toMatchObject({
      status: 'active',
      passwordHash: 'new',
      lockedUntil: null,
      failedLoginCount: 0,
      failedWindowStartedAt: null,
    });
    const b = account({ status: 'deactivated' });
    b.setPasswordHash('x');
    expect(b.status).toBe('deactivated');
  });

  it('exposes identity getters', () => {
    const a = account();
    expect([a.userId, a.email, a.name, a.role, a.status, a.passwordHash]).toEqual([
      'u1',
      'a@example.com',
      'A',
      'editor',
      'active',
      'h',
    ]);
  });
});

describe('RefreshToken (ADR-0010) — critical path', () => {
  const issue = () =>
    RefreshToken.issue({
      id: 't1',
      userId: 'u1',
      familyId: 'f1',
      tokenHash: 'h1',
      issuedAt: T0,
      expiresAt: at(14 * 24 * 60 * MIN),
    });

  it('is usable until idle timeout (SEC-12) or expiry', () => {
    const t = issue();
    expect(t.isUsableAt(at(SESSION_IDLE_MS))).toBe(true);
    expect(t.isUsableAt(at(SESSION_IDLE_MS + 1))).toBe(false);
    const short = RefreshToken.issue({
      id: 't',
      userId: 'u',
      familyId: 'f',
      tokenHash: 'h',
      issuedAt: T0,
      expiresAt: at(MIN),
    });
    expect(short.isUsableAt(at(MIN))).toBe(false);
  });

  it('rotation marks it replaced and revoked', () => {
    const t = issue();
    t.rotateTo('t2', at(MIN));
    expect([t.wasRotated(), t.isRevoked(), t.isUsableAt(at(MIN))]).toEqual([true, true, false]);
    expect(t.toProps().replacedById).toBe('t2');
  });

  it('revoke is idempotent and keeps the first timestamp', () => {
    const t = issue();
    t.revoke(at(1));
    t.revoke(at(2));
    expect(t.toProps().revokedAt).toEqual(at(1));
  });

  it('exposes getters and rehydrates', () => {
    const t = RefreshToken.rehydrate(issue().toProps());
    expect([t.id, t.userId, t.familyId, t.tokenHash, t.expiresAt]).toEqual([
      't1',
      'u1',
      'f1',
      'h1',
      at(14 * 24 * 60 * MIN),
    ]);
  });
});

describe('OneTimeToken (FR-AUTH-07/08, FR-USER-02) — critical path', () => {
  it('reset tokens live 60 minutes, invites 7 days', () => {
    const reset = OneTimeToken.issue({ id: 'o', userId: 'u', purpose: 'password_reset', tokenHash: 'h', now: T0 });
    expect(reset.isValidAt(at(ONE_TIME_TOKEN_TTL_MS.password_reset - 1), 'password_reset')).toBe(true);
    expect(reset.isValidAt(at(ONE_TIME_TOKEN_TTL_MS.password_reset), 'password_reset')).toBe(false);
    const invite = OneTimeToken.issue({ id: 'o', userId: 'u', purpose: 'invite', tokenHash: 'h', now: T0 });
    expect(invite.isValidAt(at(7 * 24 * 60 * MIN - 1), 'invite')).toBe(true);
  });

  it('is single-use and purpose-bound', () => {
    const t = OneTimeToken.issue({ id: 'o', userId: 'u', purpose: 'invite', tokenHash: 'h', now: T0 });
    expect(t.isValidAt(T0, 'password_reset')).toBe(false);
    t.consume(T0);
    expect(t.isValidAt(T0, 'invite')).toBe(false);
    const r = OneTimeToken.rehydrate(t.toProps());
    expect([r.id, r.userId, r.purpose]).toEqual(['o', 'u', 'invite']);
  });
});

describe('ApiKey (FR-PUBAPI-02) — critical path', () => {
  const create = (name = ' Web ') =>
    ApiKey.create({ id: 'k', name, keyPrefix: 'cmsk_abcdef', keyHash: 'h', createdBy: 'u', createdAt: T0 });

  it('trims and validates the name', () => {
    expect(create().toProps().name).toBe('Web');
    expect(() => create('  ')).toThrow(ValidationError);
    expect(() => create('x'.repeat(101))).toThrow(ValidationError);
  });

  it('can be revoked exactly once', () => {
    const k = create();
    expect(k.isActive).toBe(true);
    k.revoke(T0);
    expect(k.isActive).toBe(false);
    expect(() => k.revoke(T0)).toThrow(ConflictError);
  });

  it('records last use and rehydrates', () => {
    const k = create();
    k.markUsed(at(MIN));
    const r = ApiKey.rehydrate(k.toProps());
    expect([r.id, r.toProps().lastUsedAt]).toEqual(['k', at(MIN)]);
  });
});

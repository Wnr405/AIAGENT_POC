import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, STRONG_PASSWORD, type TestApp } from '../../../../../test/support/test-app';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../../shared/kernel/errors';

const meta = { ip: '198.51.100.4' };

describe('auth: login, lockout, refresh, logout — critical path', () => {
  let t: TestApp;
  let editor: ReturnType<TestApp['seedUser']>;
  beforeEach(() => {
    t = createTestApp();
    editor = t.seedUser('editor', 'Eve', 'eve@example.com');
  });

  const login = (password = STRONG_PASSWORD, email = 'eve@example.com') =>
    t.app.auth.login.execute({ email, password }, meta);

  it('FR-AUTH-01/04/10: issues access + refresh tokens and audits the login', async () => {
    const s = await login();
    expect(s.user).toEqual({ id: editor.userId, email: 'eve@example.com', name: 'Eve', role: 'editor' });
    expect(s.accessTokenExpiresIn).toBe(900);
    expect(s.refreshTokenExpiresAt).toEqual(new Date(t.clock.now().getTime() + 14 * 86400_000));
    expect(await t.app.auth.authenticateAccessToken.execute(s.accessToken)).toEqual({
      userId: editor.userId,
      role: 'editor',
    });
    expect(t.auditActions()).toEqual(['auth.login']);
    expect(t.infra.db.users.get(editor.userId)?.lastLoginAt).toEqual(t.clock.now());
  });

  it('FR-AUTH-06: every failure is the same generic 401', async () => {
    await expect(login('wrong-password-1')).rejects.toThrow('Invalid email or password');
    await expect(login(STRONG_PASSWORD, 'nobody@example.com')).rejects.toThrow('Invalid email or password');
    await expect(login(STRONG_PASSWORD, 'not-an-email')).rejects.toThrow(UnauthorizedError);
    expect(t.auditActions()).toEqual(['auth.login_failed', 'auth.login_failed', 'auth.login_failed']);
  });

  it('FR-AUTH-06 acceptance: 5 failures in 10 min lock the account; correct password rejected; works after 15 min', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(login('wrong-password-1')).rejects.toThrow(UnauthorizedError);
      t.clock.advanceMinutes(1);
    }
    await expect(login()).rejects.toThrow('Invalid email or password');
    const failed = [...t.infra.db.table<{ action: string; summary: { reason?: string } }>('audit_events').values()];
    expect(failed.map((e) => e.summary.reason)).toEqual([
      'bad_password',
      'bad_password',
      'bad_password',
      'bad_password',
      'bad_password_locked',
      'locked',
    ]);
    t.clock.advanceMinutes(15);
    expect((await login()).user.id).toBe(editor.userId);
  });

  it('invited (no password) accounts cannot log in', async () => {
    const admin = t.seedUser('admin');
    await t.app.users.invite.execute({ email: 'inv@example.com', name: 'I', role: 'author' }, admin);
    await expect(login(STRONG_PASSWORD, 'inv@example.com')).rejects.toThrow(UnauthorizedError);
  });

  it('refresh rotates the token; the old one stops working', async () => {
    const s1 = await login();
    t.clock.advanceMinutes(5);
    const s2 = await t.app.auth.refresh.execute(s1.refreshToken, meta);
    expect(s2.refreshToken).not.toBe(s1.refreshToken);
    expect(await t.app.auth.authenticateAccessToken.execute(s2.accessToken)).toMatchObject({ userId: editor.userId });
  });

  it('ADR-0010: reusing a rotated refresh token revokes the whole family', async () => {
    const s1 = await login();
    const s2 = await t.app.auth.refresh.execute(s1.refreshToken, meta);
    await expect(t.app.auth.refresh.execute(s1.refreshToken, meta)).rejects.toThrow('Session expired');
    await expect(t.app.auth.refresh.execute(s2.refreshToken, meta)).rejects.toThrow('Session expired');
    expect(t.auditActions()).toContain('auth.refresh_reuse_detected');
  });

  it('SEC-12: a session idle for more than 30 minutes cannot be refreshed', async () => {
    const s = await login();
    t.clock.advanceMinutes(31);
    await expect(t.app.auth.refresh.execute(s.refreshToken, meta)).rejects.toThrow('Session expired');
  });

  it('refresh fails (and revokes the token) if the account stopped being active', async () => {
    const s = await login();
    t.infra.db.users.get(editor.userId)!.status = 'deactivated';
    await expect(t.app.auth.refresh.execute(s.refreshToken, meta)).rejects.toThrow('Session expired');
    t.infra.db.users.get(editor.userId)!.status = 'active';
    await expect(t.app.auth.refresh.execute(s.refreshToken, meta)).rejects.toThrow('Session expired');
  });

  it('unknown refresh tokens are rejected', async () => {
    await expect(t.app.auth.refresh.execute('nope', meta)).rejects.toThrow(UnauthorizedError);
  });

  it('access tokens expire and tampered tokens are rejected', async () => {
    const s = await login();
    await expect(t.app.auth.authenticateAccessToken.execute('garbage')).rejects.toThrow(UnauthorizedError);
    t.clock.advanceMinutes(16);
    await expect(t.app.auth.authenticateAccessToken.execute(s.accessToken)).rejects.toThrow(UnauthorizedError);
  });

  it('role changes apply immediately to existing access tokens', async () => {
    const s = await login();
    t.infra.db.users.get(editor.userId)!.role = 'author';
    expect(await t.app.auth.authenticateAccessToken.execute(s.accessToken)).toEqual({
      userId: editor.userId,
      role: 'author',
    });
  });

  it('FR-AUTH-09: logout revokes the session family; unknown or missing tokens are ignored', async () => {
    const s = await login();
    await t.app.auth.logout.execute(s.refreshToken, meta);
    await expect(t.app.auth.refresh.execute(s.refreshToken, meta)).rejects.toThrow(UnauthorizedError);
    await t.app.auth.logout.execute(undefined, meta);
    await t.app.auth.logout.execute('unknown', meta);
    expect(t.auditActions().filter((a) => a === 'auth.logout')).toHaveLength(1);
  });
});

describe('auth: password reset, invites, change password — critical path', () => {
  let t: TestApp;
  beforeEach(() => {
    t = createTestApp();
    t.seedUser('editor', 'Eve', 'eve@example.com');
  });

  it('FR-AUTH-07/08: reset link works once, within 60 minutes, and revokes sessions', async () => {
    const s = await t.app.auth.login.execute({ email: 'eve@example.com', password: STRONG_PASSWORD }, meta);
    await t.app.auth.requestPasswordReset.execute('EVE@example.com', meta);
    const token = t.mail.lastTokenFor('eve@example.com');
    await t.app.auth.completePasswordReset.execute({ token, password: 'brand-new-pass-7' }, meta);
    await expect(t.app.auth.refresh.execute(s.refreshToken, meta)).rejects.toThrow(UnauthorizedError);
    await expect(
      t.app.auth.completePasswordReset.execute({ token, password: 'another-pass-8x' }, meta),
    ).rejects.toThrow('invalid or has expired');
    const s2 = await t.app.auth.login.execute({ email: 'eve@example.com', password: 'brand-new-pass-7' }, meta);
    expect(s2.user.email).toBe('eve@example.com');
    expect(t.auditActions()).toEqual([
      'auth.login',
      'auth.password_reset_requested',
      'auth.password_reset',
      'auth.login',
    ]);
  });

  it('expired reset links are rejected', async () => {
    await t.app.auth.requestPasswordReset.execute('eve@example.com', meta);
    const token = t.mail.lastTokenFor('eve@example.com');
    t.clock.advanceMinutes(60);
    await expect(
      t.app.auth.completePasswordReset.execute({ token, password: 'brand-new-pass-7' }, meta),
    ).rejects.toThrow(ValidationError);
  });

  it('only the newest reset link is valid', async () => {
    await t.app.auth.requestPasswordReset.execute('eve@example.com', meta);
    const first = t.mail.lastTokenFor('eve@example.com');
    await t.app.auth.requestPasswordReset.execute('eve@example.com', meta);
    await expect(
      t.app.auth.completePasswordReset.execute({ token: first, password: 'brand-new-pass-7' }, meta),
    ).rejects.toThrow(ValidationError);
  });

  it('reset requests never reveal whether an account exists', async () => {
    await t.app.auth.requestPasswordReset.execute('nobody@example.com', meta);
    await t.app.auth.requestPasswordReset.execute('not an email', meta);
    t.infra.db.users.forEach((u) => (u.status = 'deactivated'));
    await t.app.auth.requestPasswordReset.execute('eve@example.com', meta);
    expect(t.mail.sent).toHaveLength(0);
  });

  it('new password must satisfy the policy (FR-AUTH-02) and token must exist', async () => {
    await t.app.auth.requestPasswordReset.execute('eve@example.com', meta);
    const token = t.mail.lastTokenFor('eve@example.com');
    await expect(t.app.auth.completePasswordReset.execute({ token, password: 'short1' }, meta)).rejects.toThrow(
      'Password must contain',
    );
    await expect(
      t.app.auth.completePasswordReset.execute({ token: 'bogus', password: 'brand-new-pass-7' }, meta),
    ).rejects.toThrow(ValidationError);
  });

  it('a reset token for a deactivated user is useless', async () => {
    await t.app.auth.requestPasswordReset.execute('eve@example.com', meta);
    const token = t.mail.lastTokenFor('eve@example.com');
    t.infra.db.users.forEach((u) => (u.status = 'deactivated'));
    await expect(
      t.app.auth.completePasswordReset.execute({ token, password: 'brand-new-pass-7' }, meta),
    ).rejects.toThrow(ValidationError);
  });

  it('FR-USER-02: accepting an invite activates the account; invite tokens cannot reset passwords', async () => {
    const admin = t.seedUser('admin');
    await t.app.users.invite.execute({ email: 'new@example.com', name: 'New', role: 'author' }, admin);
    const token = t.mail.lastTokenFor('new@example.com');
    await expect(
      t.app.auth.completePasswordReset.execute({ token, password: 'brand-new-pass-7' }, meta),
    ).rejects.toThrow(ValidationError);
    await t.app.auth.acceptInvite.execute({ token, password: 'brand-new-pass-7' }, meta);
    const s = await t.app.auth.login.execute({ email: 'new@example.com', password: 'brand-new-pass-7' }, meta);
    expect(s.user.role).toBe('author');
    expect(t.auditActions()).toContain('auth.invite_accepted');
  });

  it('invite links expire after 7 days', async () => {
    const admin = t.seedUser('admin');
    await t.app.users.invite.execute({ email: 'late@example.com', name: 'L', role: 'author' }, admin);
    const token = t.mail.lastTokenFor('late@example.com');
    t.clock.advance(7 * 86400_000);
    await expect(t.app.auth.acceptInvite.execute({ token, password: 'brand-new-pass-7' }, meta)).rejects.toThrow(
      ValidationError,
    );
  });

  it('IssueOneTimeToken rejects unknown users', async () => {
    const admin = t.seedUser('admin');
    await expect(t.app.users.adminResetPassword.execute('missing', admin)).rejects.toThrow(NotFoundError);
  });

  it('change own password verifies the current one and revokes sessions (FR-AUTH-05)', async () => {
    const me = t.seedUser('author', 'Me', 'me@example.com');
    const s = await t.app.auth.login.execute({ email: 'me@example.com', password: STRONG_PASSWORD }, meta);
    await expect(
      t.app.auth.changeOwnPassword.execute({ currentPassword: 'wrong-one-123', newPassword: 'brand-new-pass-7' }, me),
    ).rejects.toThrow('Current password is incorrect');
    await expect(
      t.app.auth.changeOwnPassword.execute({ currentPassword: STRONG_PASSWORD, newPassword: 'weak' }, me),
    ).rejects.toThrow(ValidationError);
    await t.app.auth.changeOwnPassword.execute(
      { currentPassword: STRONG_PASSWORD, newPassword: 'brand-new-pass-7' },
      me,
    );
    await expect(t.app.auth.refresh.execute(s.refreshToken, meta)).rejects.toThrow(UnauthorizedError);
    expect(t.auditActions()).toContain('auth.password_change');
    await expect(
      t.app.auth.changeOwnPassword.execute(
        { currentPassword: 'x', newPassword: 'y' },
        { userId: 'ghost', role: 'author', ip: '1' },
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe('API keys (FR-PUBAPI-02, UR-D04) — critical path', () => {
  let t: TestApp;
  let admin: ReturnType<TestApp['seedUser']>;
  beforeEach(() => {
    t = createTestApp();
    admin = t.seedUser('admin');
  });

  it('creates a key shown once, stores only its hash, authenticates and revokes', async () => {
    const created = await t.app.auth.createApiKey.execute('Production Web', admin);
    expect(created.key.startsWith('cmsk_')).toBe(true);
    expect(created.prefix).toBe(created.key.slice(0, 11));
    const stored = [...t.infra.db.table<{ keyHash: string }>('api_keys').values()][0];
    expect(stored?.keyHash).not.toContain(created.key);
    expect(await t.app.auth.authenticateApiKey.execute(created.key)).toEqual({ apiKeyId: created.id });
    const list = await t.app.auth.listApiKeys.execute(admin);
    expect(list.map((k) => [k.name, k.revokedAt])).toEqual([['Production Web', null]]);
    expect(list[0]).not.toHaveProperty('key');
    await t.app.auth.revokeApiKey.execute(created.id, admin);
    await expect(t.app.auth.authenticateApiKey.execute(created.key)).rejects.toThrow('Invalid API key');
    expect(t.auditActions()).toEqual(['api_key.create', 'api_key.revoke']);
  });

  it('rejects missing, malformed and unknown keys', async () => {
    await expect(t.app.auth.authenticateApiKey.execute(undefined)).rejects.toThrow(UnauthorizedError);
    await expect(t.app.auth.authenticateApiKey.execute('abc')).rejects.toThrow(UnauthorizedError);
    await expect(t.app.auth.authenticateApiKey.execute('cmsk_unknown')).rejects.toThrow(UnauthorizedError);
  });

  it('updates last_used_at at most once per minute', async () => {
    const { key, id } = await t.app.auth.createApiKey.execute('k', admin);
    await t.app.auth.authenticateApiKey.execute(key);
    const first = (await t.app.auth.listApiKeys.execute(admin))[0]?.lastUsedAt;
    t.clock.advance(30_000);
    await t.app.auth.authenticateApiKey.execute(key);
    expect((await t.app.auth.listApiKeys.execute(admin))[0]?.lastUsedAt).toEqual(first);
    t.clock.advance(30_000);
    await t.app.auth.authenticateApiKey.execute(key);
    expect((await t.app.auth.listApiKeys.execute(admin)).find((k) => k.id === id)?.lastUsedAt).toEqual(t.clock.now());
  });

  it('only admins manage keys; unknown keys are 404', async () => {
    const editor = t.seedUser('editor');
    await expect(t.app.auth.createApiKey.execute('x', editor)).rejects.toThrow(ForbiddenError);
    await expect(t.app.auth.listApiKeys.execute(editor)).rejects.toThrow(ForbiddenError);
    await expect(t.app.auth.revokeApiKey.execute('x', editor)).rejects.toThrow(ForbiddenError);
    await expect(t.app.auth.revokeApiKey.execute('missing', admin)).rejects.toThrow(NotFoundError);
  });
});

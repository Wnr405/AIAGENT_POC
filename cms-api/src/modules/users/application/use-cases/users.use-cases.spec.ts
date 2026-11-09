import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../../../../../test/support/test-app';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../../shared/kernel/errors';
import { EmailTakenError, LastAdminError } from '../../domain/user-errors';

describe('users use cases (FR-USER-*)', () => {
  let t: TestApp;
  let admin: ReturnType<TestApp['seedUser']>;
  beforeEach(() => {
    t = createTestApp();
    admin = t.seedUser('admin', 'Ada Admin', 'ada@example.com');
  });

  it('UR-A01 / FR-USER-02/08: invite creates an invited user and emails a one-time link', async () => {
    const view = await t.app.users.invite.execute({ email: 'New@Example.com', name: 'Nia', role: 'author' }, admin);
    expect(view).toMatchObject({
      email: 'new@example.com',
      name: 'Nia',
      role: 'author',
      status: 'invited',
      lastLoginAt: null,
    });
    expect(t.mail.sent).toHaveLength(1);
    expect(t.mail.sent[0]?.subject).toBe("You're invited to CMS");
    expect(t.mail.sent[0]?.text).toContain('http://localhost:5173/accept-invite?token=');
    expect(t.auditActions()).toEqual(['user.invite']);
  });

  it('FR-USER-07: email must be unique and valid', async () => {
    await expect(
      t.app.users.invite.execute({ email: 'ADA@example.com', name: 'X', role: 'author' }, admin),
    ).rejects.toThrow(EmailTakenError);
    await expect(t.app.users.invite.execute({ email: 'bad', name: 'X', role: 'author' }, admin)).rejects.toThrow(
      ValidationError,
    );
  });

  it('FR-USER-01: only admins manage users', async () => {
    const editor = t.seedUser('editor');
    await expect(
      t.app.users.invite.execute({ email: 'x@example.com', name: 'X', role: 'author' }, editor),
    ).rejects.toThrow(ForbiddenError);
    await expect(t.app.users.list.execute({}, editor)).rejects.toThrow(ForbiddenError);
    await expect(t.app.users.update.execute({ userId: admin.userId, name: 'x' }, editor)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(t.app.users.deactivate.execute(admin.userId, editor)).rejects.toThrow(ForbiddenError);
    await expect(t.app.users.adminResetPassword.execute(admin.userId, editor)).rejects.toThrow(ForbiddenError);
  });

  it('FR-USER-06: lists users with filters and paging', async () => {
    t.seedUser('editor', 'Eve Editor', 'eve@example.com');
    t.seedUser('author', 'Al Author', 'al@example.com');
    const all = await t.app.users.list.execute({}, admin);
    expect(all.items.map((u) => u.name)).toEqual(['Ada Admin', 'Al Author', 'Eve Editor']);
    const eds = await t.app.users.list.execute(
      { role: 'editor', status: 'active', search: 'EVE', page: 1, pageSize: 10 },
      admin,
    );
    expect(eds.items.map((u) => u.email)).toEqual(['eve@example.com']);
  });

  it('UR-A02: updates name and role', async () => {
    const author = t.seedUser('author');
    const v = await t.app.users.update.execute({ userId: author.userId, name: 'Promoted', role: 'editor' }, admin);
    expect([v.name, v.role]).toEqual(['Promoted', 'editor']);
    await expect(t.app.users.update.execute({ userId: 'missing', name: 'x' }, admin)).rejects.toThrow(NotFoundError);
  });

  it('FR-USER-04: the last active admin cannot be demoted or deactivated', async () => {
    await expect(t.app.users.update.execute({ userId: admin.userId, role: 'editor' }, admin)).rejects.toThrow(
      LastAdminError,
    );
    await expect(t.app.users.deactivate.execute(admin.userId, admin)).rejects.toThrow(LastAdminError);
    const second = t.seedUser('admin');
    await t.app.users.update.execute({ userId: admin.userId, role: 'admin', name: 'Still admin' }, admin);
    const v = await t.app.users.deactivate.execute(second.userId, admin);
    expect(v.status).toBe('deactivated');
  });

  it('UR-A03 / FR-USER-05: deactivation revokes sessions and blocks login immediately', async () => {
    const author = t.seedUser('author', 'Au', 'au@example.com');
    const session = await t.app.auth.login.execute(
      { email: 'au@example.com', password: 'correct-horse-42' },
      { ip: '1.1.1.1' },
    );
    await t.app.users.deactivate.execute(author.userId, admin);
    await expect(t.app.auth.refresh.execute(session.refreshToken, { ip: '1.1.1.1' })).rejects.toThrow(
      'Session expired',
    );
    await expect(t.app.auth.authenticateAccessToken.execute(session.accessToken)).rejects.toThrow(
      'Authentication required',
    );
    await expect(
      t.app.auth.login.execute({ email: 'au@example.com', password: 'correct-horse-42' }, { ip: '1.1.1.1' }),
    ).rejects.toThrow('Invalid email or password');
    expect(t.auditActions()).toContain('user.deactivate');
  });

  it('get: self or admin only', async () => {
    const author = t.seedUser('author');
    expect((await t.app.users.get.execute(author.userId, author)).id).toBe(author.userId);
    expect((await t.app.users.get.execute(author.userId, admin)).role).toBe('author');
    await expect(t.app.users.get.execute(admin.userId, author)).rejects.toThrow(ForbiddenError);
  });

  it('UR-A05: admin reset emails a reset link; invited users get a fresh invite instead', async () => {
    const editor = t.seedUser('editor', 'Ed', 'ed@example.com');
    await t.app.users.adminResetPassword.execute(editor.userId, admin);
    expect(t.mail.sent.at(-1)?.subject).toBe('Reset your CMS password');
    const invited = await t.app.users.invite.execute({ email: 'inv@example.com', name: 'Inv', role: 'author' }, admin);
    await t.app.users.adminResetPassword.execute(invited.id, admin);
    expect(t.mail.sent.at(-1)?.subject).toBe("You're invited to CMS");
    expect(t.auditActions()).toContain('user.password_reset_by_admin');
    const gone = t.seedUser('author');
    t.infra.db.users.get(gone.userId)!.status = 'deactivated';
    await expect(t.app.users.adminResetPassword.execute(gone.userId, admin)).rejects.toThrow('User is deactivated');
  });
});

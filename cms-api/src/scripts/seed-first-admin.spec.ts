import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/support/test-app';
import { seedFirstAdmin } from './seed-first-admin';

describe('seedFirstAdmin', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('invites the first admin when there are no users', async () => {
    const t = createTestApp();
    process.env['SEED_ADMIN_EMAIL'] = 'boss@example.com';
    await seedFirstAdmin(t.app, t.logger);
    const [user] = [...t.infra.db.users.values()];
    expect([user?.email, user?.role, user?.status]).toEqual(['boss@example.com', 'admin', 'invited']);
    expect(t.mail.sent.map((m) => m.to)).toEqual(['boss@example.com']);
  });

  it('does nothing when users already exist', async () => {
    const t = createTestApp();
    t.seedUser('editor');
    await seedFirstAdmin(t.app, t.logger);
    expect(t.infra.db.users.size).toBe(1);
  });

  it('applies SEED_ADMIN_PASSWORD in development only', async () => {
    const t = createTestApp();
    process.env['NODE_ENV'] = 'development';
    process.env['SEED_ADMIN_PASSWORD'] = 'dev-password-123';
    await seedFirstAdmin(t.app, t.logger);
    const s = await t.app.auth.login.execute({ email: 'admin@example.com', password: 'dev-password-123' }, { ip: '1' });
    expect(s.user.role).toBe('admin');
    expect(t.mail.sent).toHaveLength(0);

    const prod = createTestApp();
    process.env['NODE_ENV'] = 'production';
    await seedFirstAdmin(prod.app, prod.logger);
    expect([...prod.infra.db.users.values()][0]?.status).toBe('invited');
  });
});

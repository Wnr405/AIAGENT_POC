import type { Container } from '../composition/container';
import { User } from '../modules/users/domain/user.entity';
import { assertPasswordPolicy } from '../modules/auth/domain/password-policy';
import type { Logger } from '../shared/ports/logger.port';

/**
 * Bootstraps the very first Admin when the user table is empty.
 *
 * - Default: the admin is created as *invited* and receives a normal invite
 *   link (with EMAIL_PROVIDER=console the link is printed to the log).
 * - Local development only: if NODE_ENV=development and SEED_ADMIN_PASSWORD is
 *   set, that password is applied directly so `pnpm dev` is usable at once.
 *   It must still satisfy the password policy (FR-AUTH-02).
 */
export async function seedFirstAdmin(c: Container, logger: Logger): Promise<void> {
  const { users, authAccounts } = c.infra.repos;
  if ((await users.findMany({}, { page: 1, pageSize: 1 })).total > 0) return;

  const email = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@example.com';
  const name = process.env['SEED_ADMIN_NAME'] ?? 'Administrator';
  const id = c.infra.ids.next();
  const self = { userId: id, role: 'admin' as const, ip: '127.0.0.1' };
  await users.save(User.invite({ id, email, name, role: 'admin', now: c.infra.clock.now() }, self));

  const devPassword = process.env['SEED_ADMIN_PASSWORD'];
  if (devPassword && process.env['NODE_ENV'] === 'development') {
    assertPasswordPolicy(devPassword);
    const account = await authAccounts.findById(id);
    if (account) {
      account.setPasswordHash(await c.infra.passwordHasher.hash(devPassword));
      await authAccounts.save(account);
      logger.warn('seeded first admin with SEED_ADMIN_PASSWORD (development only)', { userId: id });
      return;
    }
  }
  await c.users.adminResetPassword.execute(id, self); // sends the invite link
  logger.info('seeded first admin as an invite', { userId: id });
}

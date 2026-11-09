import { buildContainer } from '../../src/composition/container';
import { DEFAULT_SETTINGS, type AppSettings } from '../../src/composition/infrastructure';
import { buildMemoryInfrastructure } from '../../src/composition/memory-infrastructure';
import type { ActorContext } from '../../src/shared/kernel/actor';
import type { Role } from '../../src/shared/kernel/role';
import { FakeClock } from '../fakes/fake-clock';
import {
  FakeImageProcessor,
  FakePasswordHasher,
  FakeSecretGenerator,
  FakeTokenSigner,
  RecordingEmailSender,
  RecordingJobScheduler,
  SequentialIdGenerator,
  SilentLogger,
} from '../fakes/fakes';

export const STRONG_PASSWORD = 'correct-horse-42';

/**
 * Full application wired with in-memory adapters and deterministic fakes.
 * Tests drive behaviour through the same use cases the HTTP layer calls.
 */
export function createTestApp(settings: Partial<AppSettings> = {}) {
  const clock = new FakeClock();
  const mail = new RecordingEmailSender();
  const jobs = new RecordingJobScheduler();
  const logger = new SilentLogger();
  const infra = buildMemoryInfrastructure(
    {
      passwordHasher: new FakePasswordHasher(),
      tokenSigner: new FakeTokenSigner(clock),
      emailSender: mail,
      images: new FakeImageProcessor(),
      logger,
      jobs,
    },
    { clock, ids: new SequentialIdGenerator(), secrets: new FakeSecretGenerator() },
  );
  const app = buildContainer(infra, { ...DEFAULT_SETTINGS, ...settings });

  const actor = (userId: string, role: Role): ActorContext => ({ userId, role, ip: '203.0.113.7' });

  /** Seeds an active user directly in the store (bypassing invite) and returns its actor. */
  const seedUser = (role: Role, name = `${role} user`, email = `${role}-${infra.db.users.size + 1}@example.com`) => {
    const id = infra.ids.next();
    const now = clock.now();
    infra.db.users.set(id, {
      id,
      email,
      name,
      role,
      status: 'active',
      passwordHash: `hashed:${STRONG_PASSWORD}`,
      failedLoginCount: 0,
      failedWindowStartedAt: null,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });
    return { ...actor(id, role), email, name };
  };

  const auditActions = (): string[] =>
    [...infra.db.table<{ action: string; occurredAt: Date }>('audit_events').values()]
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      .map((r) => r.action);

  return { app, infra, clock, mail, jobs, logger, actor, seedUser, auditActions };
}

export type TestApp = ReturnType<typeof createTestApp>;

/** A minimal valid TipTap document with one paragraph. */
export const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

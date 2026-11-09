import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaContext } from '../../src/shared/adapters/prisma/prisma-context';
import {
  PrismaContentRepository,
  PrismaContentVersionRepository,
} from '../../src/modules/content/adapters/out/persistence/prisma-content.repositories';
import { PrismaUserRepository } from '../../src/modules/users/adapters/out/persistence/prisma-user.repository';
import { PrismaAuditEventRepository } from '../../src/modules/audit/adapters/out/persistence/prisma-audit.repository';
import { User } from '../../src/modules/users/domain/user.entity';
import { aContent } from '../builders/a-content';

/**
 * Outbound persistence adapters against a real PostgreSQL 15 (06-TEST-STRATEGY §7.5).
 * Requires Docker. Run with `pnpm test:integration`.
 */
describe('Prisma adapters (integration)', () => {
  let pg: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let ctx: PrismaContext;
  const admin = { userId: '00000000-0000-4000-8000-0000000000a1', role: 'admin' as const, ip: '127.0.0.1' };
  const T = new Date('2026-05-01T00:00:00Z');

  beforeAll(async () => {
    pg = await new PostgreSqlContainer('postgres:15-alpine').start();
    process.env['DATABASE_URL'] = pg.getConnectionUri();
    execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
    prisma = new PrismaClient({ datasources: { db: { url: pg.getConnectionUri() } } });
    ctx = new PrismaContext(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await pg.stop();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE content_media_refs, content_versions, contents, media_items, refresh_tokens, one_time_tokens, api_keys, users CASCADE',
    );
    await new PrismaUserRepository(ctx).save(
      User.invite({ id: admin.userId, email: 'author@example.com', name: 'Author', role: 'admin', now: T }, admin),
    );
  });

  it('content mapper round-trips and enforces the public visibility filter (RK-04)', async () => {
    const repo = new PrismaContentRepository(ctx);
    await repo.save(aContent({ authorId: admin.userId }));
    await repo.save(
      aContent({
        id: '00000000-0000-4000-8000-0000000000c2',
        slug: aContent().slug.withSuffix(2),
        authorId: admin.userId,
        status: 'published',
        publishedAt: T,
      }),
    );
    const loaded = await repo.findById('00000000-0000-4000-8000-0000000000c1');
    expect(loaded?.toSnapshot()).toEqual(aContent().toSnapshot());
    const pub = await repo.findPublished('article', {}, { page: 1, pageSize: 25 }, new Date('2026-06-01'));
    expect(pub.items.map((c) => c.id)).toEqual(['00000000-0000-4000-8000-0000000000c2']);
    expect(await repo.findPublished('article', {}, { page: 1, pageSize: 25 }, new Date('2026-04-01'))).toMatchObject({
      total: 0,
    });
  });

  it('enforces (type, slug) uniqueness at the database level', async () => {
    const repo = new PrismaContentRepository(ctx);
    await repo.save(aContent({ authorId: admin.userId }));
    await expect(
      repo.save(aContent({ id: '00000000-0000-4000-8000-0000000000c9', authorId: admin.userId })),
    ).rejects.toThrow();
  });

  it('versions: append, list newest first, prune to N', async () => {
    const content = aContent({ authorId: admin.userId });
    await new PrismaContentRepository(ctx).save(content);
    const versions = new PrismaContentVersionRepository(ctx);
    for (let n = 1; n <= 5; n++) {
      await versions.append({
        id: `00000000-0000-4000-8000-00000000010${n}`,
        contentId: content.id,
        versionNo: n,
        snapshot: content.toSnapshot(),
        editorId: admin.userId,
        createdAt: T,
      });
    }
    await versions.prune(content.id, 3);
    expect((await versions.list(content.id)).map((v) => v.versionNo)).toEqual([5, 4, 3]);
    expect(await versions.latestVersionNo(content.id)).toBe(5);
  });

  it('FR-AUDIT-03: UPDATE and DELETE on audit_events are rejected by the database', async () => {
    const audit = new PrismaAuditEventRepository(ctx);
    await audit.append({
      id: '00000000-0000-4000-8000-0000000000e1',
      occurredAt: T,
      actorId: null,
      actorIp: '1.1.1.1',
      action: 'x',
      targetType: 'y',
      targetId: null,
      summary: {},
    });
    await expect(prisma.$executeRawUnsafe(`UPDATE audit_events SET action = 'z'`)).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM audit_events`)).rejects.toThrow(/append-only/);
  });

  it('transactions roll back every repository write on failure', async () => {
    const repo = new PrismaContentRepository(ctx);
    await expect(
      ctx.run(async () => {
        await repo.save(aContent({ authorId: admin.userId }));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await repo.findById('00000000-0000-4000-8000-0000000000c1')).toBeNull();
  });
});

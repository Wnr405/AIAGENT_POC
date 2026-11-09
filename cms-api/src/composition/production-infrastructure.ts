import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.schema';
import { BullMqJobScheduler } from '../shared/adapters/bullmq-job-scheduler';
import { CacheRateLimiter } from '../shared/adapters/cache-rate-limiter';
import { InProcessEventPublisher } from '../shared/adapters/in-process-event-publisher';
import { NodeSecretGenerator, Sha256TokenHasher, UuidV4Generator } from '../shared/adapters/node-crypto';
import { createPino, PinoLogger } from '../shared/adapters/pino-logger';
import { PrismaContext } from '../shared/adapters/prisma/prisma-context';
import { RedisCacheAdapter } from '../shared/adapters/redis-cache.adapter';
import { SystemClock } from '../shared/adapters/system-clock';
import { PrismaAuditEventRepository } from '../modules/audit/adapters/out/persistence/prisma-audit.repository';
import { Argon2PasswordHasher } from '../modules/auth/adapters/out/crypto/argon2-password-hasher';
import { JoseJwtSigner } from '../modules/auth/adapters/out/crypto/jose-jwt-signer';
import {
  PrismaApiKeyRepository,
  PrismaAuthAccountRepository,
  PrismaOneTimeTokenRepository,
  PrismaRefreshTokenRepository,
} from '../modules/auth/adapters/out/persistence/prisma-auth.repositories';
import {
  PrismaContentRepository,
  PrismaContentVersionRepository,
} from '../modules/content/adapters/out/persistence/prisma-content.repositories';
import { SharpImageProcessor } from '../modules/media/adapters/out/image/sharp-image-processor';
import { PrismaMediaRepository } from '../modules/media/adapters/out/persistence/prisma-media.repository';
import { S3ObjectStorageAdapter } from '../modules/media/adapters/out/storage/s3-object-storage.adapter';
import { ConsoleEmailSender, SmtpEmailSender } from '../modules/notifications/adapters/out/email/email-senders';
import { PrismaUserRepository } from '../modules/users/adapters/out/persistence/prisma-user.repository';
import type { Infrastructure } from './infrastructure';
import { buildMemoryInfrastructure } from './memory-infrastructure';

export interface Runtime {
  infra: Infrastructure;
  readinessChecks: Record<string, () => Promise<void>>;
  shutdown: () => Promise<void>;
  redis?: Redis;
}

function commonAdapters(env: Env) {
  const logger = new PinoLogger(
    createPino(env.LOG_LEVEL, { service: env.OTEL_SERVICE_NAME, version: env.APP_VERSION, role: env.ROLE }),
  );
  return {
    logger,
    passwordHasher: new Argon2PasswordHasher({
      memoryCost: env.ARGON2_MEMORY_KB,
      timeCost: env.ARGON2_ITERATIONS,
      parallelism: env.ARGON2_PARALLELISM,
    }),
    tokenSigner: new JoseJwtSigner(env.JWT_SECRET),
    emailSender:
      env.EMAIL_PROVIDER === 'console'
        ? new ConsoleEmailSender(logger)
        : new SmtpEmailSender(
            {
              host: env.SMTP_HOST as string,
              port: env.SMTP_PORT,
              secure: env.SMTP_SECURE,
              user: env.SMTP_USER,
              password: env.SMTP_PASSWORD,
            },
            `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
          ),
    images: new SharpImageProcessor(),
  };
}

/** Builds real adapters from the validated environment (composition root). */
export function buildRuntime(env: Env): Runtime {
  const common = commonAdapters(env);
  return env.PERSISTENCE === 'memory' ? memoryRuntime(env, common) : postgresRuntime(env, common);
}

function memoryRuntime(env: Env, common: ReturnType<typeof commonAdapters>): Runtime {
  const jobs = { enqueue: () => Promise.resolve() }; // variants are generated inline below
  const infra = buildMemoryInfrastructure(
    { ...common, jobs },
    { baseUrl: env.API_PUBLIC_URL.replace(/\/api\/?$/, '') },
  );
  return { infra, readinessChecks: {}, shutdown: () => Promise.resolve() };
}

function s3Storage(env: Env): S3ObjectStorageAdapter {
  return new S3ObjectStorageAdapter({
    endpoint: env.OBJECT_STORAGE_PROVIDER === 'minio' ? env.OBJECT_STORAGE_ENDPOINT : undefined,
    presignEndpoint: env.OBJECT_STORAGE_PRESIGN_ENDPOINT,
    region: env.OBJECT_STORAGE_REGION,
    bucket: env.OBJECT_STORAGE_BUCKET,
    accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY as string,
    secretAccessKey: env.OBJECT_STORAGE_SECRET_KEY as string,
    publicUrl: env.OBJECT_STORAGE_PUBLIC_URL,
    forcePathStyle: env.OBJECT_STORAGE_PROVIDER === 'minio',
  });
}

function postgresRuntime(env: Env, common: ReturnType<typeof commonAdapters>): Runtime {
  const prisma = new PrismaClient();
  const ctx = new PrismaContext(prisma);
  const redis = new Redis(env.REDIS_URL as string, { maxRetriesPerRequest: null });
  const clock = new SystemClock();
  const cache = new RedisCacheAdapter(redis);
  const jobs = new BullMqJobScheduler(redis);
  const infra: Infrastructure = {
    ...common,
    clock,
    ids: new UuidV4Generator(),
    secrets: new NodeSecretGenerator(),
    tokenHasher: new Sha256TokenHasher(),
    cache,
    rateLimiter: new CacheRateLimiter(cache, clock),
    jobs,
    tx: ctx,
    events: new InProcessEventPublisher(common.logger),
    storage: s3Storage(env),
    repos: {
      users: new PrismaUserRepository(ctx),
      authAccounts: new PrismaAuthAccountRepository(ctx),
      refreshTokens: new PrismaRefreshTokenRepository(ctx),
      oneTimeTokens: new PrismaOneTimeTokenRepository(ctx),
      apiKeys: new PrismaApiKeyRepository(ctx),
      contents: new PrismaContentRepository(ctx),
      versions: new PrismaContentVersionRepository(ctx),
      media: new PrismaMediaRepository(ctx),
      audit: new PrismaAuditEventRepository(ctx),
    },
  };
  return {
    infra,
    redis,
    readinessChecks: {
      database: async () => {
        await prisma.$queryRaw`SELECT 1`;
      },
      redis: async () => {
        await redis.ping();
      },
    },
    shutdown: async () => {
      await jobs.close();
      await prisma.$disconnect();
      redis.disconnect();
    },
  };
}

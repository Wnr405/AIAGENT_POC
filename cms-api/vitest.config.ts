import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * 05-METRICS §3: coverage gates. Two in-process projects (vitest.workspace.ts):
 *  - unit: domain + application + in-memory adapters (fast, no I/O)
 *  - e2e:  the full Nest HTTP pipeline over in-memory adapters (supertest)
 * Driven adapters that need real infrastructure (Prisma, Redis, S3, sharp,
 * SMTP) are covered by vitest.integration.config.ts (Testcontainers).
 */
const CRITICAL = { lines: 100, branches: 100, functions: 100, statements: 100 };

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })], // decorator metadata for Nest DI
  test: {
    environment: 'node',
    env: { TZ: 'UTC' },
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov', 'cobertura'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        // Composition roots / process entrypoints — exercised by E2E + deploy smoke tests (§3.4).
        'src/main.ts',
        'src/worker.ts',
        'src/tracing.ts',
        'src/scripts/seed.ts',
        'src/scripts/migrate.ts',
        'src/scripts/worker-heartbeat.ts',
        'src/openapi/generate.ts',
        'src/composition/production-infrastructure.ts',
        // Type-only files (§3.4)
        'src/**/*.port.ts',
        'src/**/ports/**',
        'src/shared/http/runtime.ts',
        // Real-infrastructure adapters → integration suite
        'src/**/prisma-*.ts',
        'src/shared/adapters/prisma/**',
        'src/shared/adapters/redis-*.ts',
        'src/shared/adapters/bullmq-*.ts',
        'src/shared/adapters/pino-logger.ts',
        'src/shared/http/sentry.ts',
        'src/**/s3-*.ts',
        'src/**/sharp-*.ts',
        'src/**/argon2-*.ts',
        'src/**/jose-*.ts',
        'src/**/email-senders.ts',
      ],
      thresholds: {
        lines: 98,
        branches: 98,
        functions: 98,
        statements: 98,
        // §3.3 critical paths — 100%
        'src/shared/kernel/permissions.ts': CRITICAL,
        'src/modules/auth/domain/**': CRITICAL,
        'src/modules/auth/application/use-cases/session.use-cases.ts': CRITICAL,
        'src/modules/auth/application/use-cases/api-keys.use-cases.ts': CRITICAL,
        'src/modules/content/domain/services/**': CRITICAL,
        'src/modules/content/domain/value-objects/rich-text-body.vo.ts': CRITICAL,
        'src/modules/content/application/policies/**': CRITICAL,
        'src/modules/media/domain/file-type-policy.ts': CRITICAL,
        'src/modules/media/domain/svg-safety.ts': CRITICAL,
        'src/modules/public-api/domain/published-content.ts': CRITICAL,
        'src/modules/audit/application/use-cases/audit.use-cases.ts': CRITICAL,
      },
    },
  },
});
